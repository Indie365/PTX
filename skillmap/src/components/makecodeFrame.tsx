/// <reference path="../../../built/pxteditor.d.ts" />
import * as React from "react";
import { connect } from 'react-redux';
import { isLocal, resolvePath, getEditorUrl, tickEvent } from "../lib/browserUtils";
import { lookupActivityProgress } from "../lib/skillMapUtils";

import { SkillMapState } from '../store/reducer';
import  { dispatchSetHeaderIdForActivity, dispatchCloseActivity, dispatchSaveAndCloseActivity, dispatchUpdateUserCompletedTags, dispatchSetShareStatus } from '../actions/dispatch';

/* eslint-disable import/no-unassigned-import, import/no-internal-modules */
import '../styles/makecode-editor.css'
/* eslint-enable import/no-unassigned-import, import/no-internal-modules */

interface MakeCodeFrameProps {
    save: boolean;
    mapId: string;
    activityId: string;
    title: string;
    tutorialPath: string;
    activityHeaderId?: string;
    activityType: MapActivityType;
    carryoverCode: boolean;
    previousHeaderId?: string;
    progress?: ActivityState;
    shareHeaderId?: string;
    dispatchSetHeaderIdForActivity: (mapId: string, activityId: string, id: string, currentStep: number, maxSteps: number, isCompleted: boolean) => void;
    dispatchCloseActivity: (finished?: boolean) => void;
    dispatchSaveAndCloseActivity: () => void;
    dispatchUpdateUserCompletedTags: () => void;
    dispatchSetShareStatus: (headerId?: string, url?: string) => void;
}

type FrameState = "loading" | "no-project" | "opening-project" | "project-open" | "closing-project";

interface MakeCodeFrameState {
    frameState: FrameState;
    loadPercent?: number; // Progress bar load % from 0 - 100 (loaded)
    workspaceReady: boolean;
    pendingShare: boolean;
}

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

export const editorUrl: string = isLocal() ? "http://localhost:3232/index.html" : getEditorUrl((window as any).pxtTargetBundle.appTheme.embedUrl)

class MakeCodeFrameImpl extends React.Component<MakeCodeFrameProps, MakeCodeFrameState> {
    protected ref: HTMLIFrameElement | undefined;
    protected messageQueue: pxt.editor.EditorMessageRequest[] = [];
    protected finishedActivityState: "saving" | "finished" | undefined;
    protected nextId: number = 0;
    protected pendingMessages: {[index: string]: PendingMessage} = {};
    protected isNewActivity: boolean = false;

    constructor(props: MakeCodeFrameProps) {
        super(props);
        this.state = {
            frameState: "loading",
            workspaceReady: false,
            loadPercent: 0,
            pendingShare: false
        };
    }

    async componentDidUpdate() {
        const { shareHeaderId } = this.props;
        const { frameState, pendingShare } = this.state;
        if (frameState === "project-open" && this.props.save) {
            this.setState({ frameState: "closing-project" }, async () => {
                await this.closeActivityAsync();
            })
        }
        else if (frameState === "no-project" && this.props.activityId) {
            this.setState({ frameState: "opening-project", loadPercent: 0 }, async () => {
                await this.startActivityAsync();
            });
        }

        if (shareHeaderId && !pendingShare) {
            this.setState({ pendingShare: true }, async () => {
                await this.shareProjectAsync();
            });
        }
    }

    componentWillUnmount() {
        window.removeEventListener("message", this.onMessageReceived);

        // Show Usabilla widget + footer
        setElementVisible(".usabilla_live_button_container", true);
        setElementVisible("footer", true);

        const root = document.getElementById("root");
        if (root) pxt.BrowserUtils.removeClass(root, "editor");
    }

    render() {
        const {title, activityId } = this.props;
        const { frameState, loadPercent } = this.state;

        const loadingText =  lf("Loading...")
        const imageAlt = "MakeCode Logo";

        const openingProject = frameState === "opening-project";
        const showLoader = openingProject || frameState === "closing-project";

        let url = editorUrl
        if (editorUrl.charAt(editorUrl.length - 1) === "/" && !isLocal()) {
            url = editorUrl.substr(0, editorUrl.length - 1);
        }
        url += `?controller=1&skillsMap=1&noproject=1&nocookiebanner=1&ws=browser`;

        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
        return <div className="makecode-frame-outer" style={{ display: activityId ? "block" : "none" }}>
            <div className={`makecode-frame-loader ${showLoader ? "" : "hidden"}`}>
                <img src={resolvePath("assets/logo.svg")} alt={imageAlt} />
                {openingProject && <div className="makecode-frame-loader-bar">
                    <div className="makecode-frame-loader-fill" style={{ width: loadPercent + "%" }} />
                </div>}
                <div className="makecode-frame-loader-text">{loadingText}</div>
            </div>
            <iframe className="makecode-frame" src={url} title={title} ref={this.handleFrameRef}></iframe>
        </div>
        /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
    }


    protected handleFrameRef = (ref: HTMLIFrameElement) => {
        if (ref && ref.contentWindow) {
            window.addEventListener("message", this.onMessageReceived);
            ref.addEventListener("load", this.handleFrameReload)
            this.ref = ref;
            // Hide Usabilla widget + footer when inside iframe view
            setElementVisible(".usabilla_live_button_container", false);
            setElementVisible("footer", false);

            const root = document.getElementById("root");
            if (root) pxt.BrowserUtils.addClass(root, "editor");
        }
    }

    protected handleFrameReload = () => {
        this.setState({frameState: "loading"})
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data as pxt.editor.EditorMessageRequest;
        if (this.state.frameState === "opening-project") this.setState({ loadPercent: Math.min((this.state.loadPercent || 0) + 4, 95) });

        if (data.type === "pxteditor" && data.id && this.pendingMessages[data.id]) {
            const pending = this.pendingMessages[data.id];
            pending.handler(data);
            delete this.pendingMessages[data.id];
            return;
        }

        switch (data.action) {
            case "newproject":
                if (this.state.frameState === "loading") {
                    this.setState({ frameState: "no-project" });
                }
                break;
            case "tutorialevent":
                this.handleTutorialEvent(data as pxt.editor.EditorMessageTutorialEventRequest);
                break;
            default:
                // console.log(JSON.stringify(data, null, 4));
        }
    }

    protected sendMessageAsync(message: any) {
        return new Promise(resolve => {
            const sendMessageCore = (message: any) => {
                message.response = true;
                message.id = this.nextId++ + "";
                this.pendingMessages[message.id] = {
                    original: message,
                    handler: resolve
                };
                this.ref!.contentWindow!.postMessage(message, "*");
            }

            if (this.ref) {
                if (!this.ref.contentWindow) {
                    this.messageQueue.push(message);
                }
                else {
                    while (this.messageQueue.length) {
                        sendMessageCore(this.messageQueue.shift());
                    }
                    sendMessageCore(message);
                }
            }
        });
    }

    protected async startActivityAsync() {
        if (this.props.activityHeaderId) {
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "openheader",
                headerId: this.props.activityHeaderId
            }  as pxt.editor.EditorMessageOpenHeaderRequest);
        }
        else {
            this.isNewActivity = true;
            await this.sendMessageAsync({
                type: "pxteditor",
                action: "startactivity",
                path: this.props.tutorialPath,
                title: this.props.title,
                activityType: "tutorial",
                carryoverPreviousCode: this.props.carryoverCode,
                previousProjectHeaderId: this.props.previousHeaderId
            } as pxt.editor.EditorMessageStartActivity);
        }
    }

    protected async closeActivityAsync() {
        await this.sendMessageAsync({
            type: "pxteditor",
            action: "saveproject"
        } as pxt.editor.EditorMessageRequest);

        this.props.dispatchCloseActivity(this.finishedActivityState === "finished");
        this.props.dispatchUpdateUserCompletedTags();
        this.finishedActivityState = undefined;

        await this.sendMessageAsync({
            type: "pxteditor",
            action: "unloadproject"
        } as pxt.editor.EditorMessageRequest);

        this.setState({ frameState: "no-project" });
    }

    protected async shareProjectAsync() {
        const { shareHeaderId, dispatchSetShareStatus } = this.props;

        const resp = (await this.sendMessageAsync({
            type: "pxteditor",
            action: "shareproject",
            headerId: shareHeaderId
        })) as any;

        dispatchSetShareStatus(shareHeaderId, resp.resp.shortid);
        this.setState({
            pendingShare: false
        });
    }

    protected handleTutorialEvent(event: pxt.editor.EditorMessageTutorialEventRequest) {
        const { dispatchSetHeaderIdForActivity, mapId, activityId, progress } = this.props;

        switch (event.tutorialEvent) {
            case "progress":
                if (activityId) {
                    dispatchSetHeaderIdForActivity(
                        mapId,
                        activityId,
                        event.projectHeaderId,
                        event.currentStep + 1,
                        event.totalSteps,
                        event.isCompleted || !!progress?.isCompleted
                    );
                }
                break;
            case "loaded":
                this.onEditorLoaded();
                break;
            case "completed":
                this.onTutorialFinished();
                break;
        }
    }

    protected onEditorLoaded() {
        const { mapId, activityId } = this.props;
        if (mapId && activityId) {
            tickEvent("skillmap.activity.loaded", { path: mapId, activity: activityId });
            this.setState({
                frameState: "project-open"
            });

            if (this.isNewActivity) {
                this.isNewActivity = false;
            }
        }
    }

    protected onTutorialFinished() {
        const { mapId, activityId } = this.props;
        tickEvent("skillmap.activity.complete", { path: mapId, activity: activityId });
        this.finishedActivityState = "finished";
        this.props.dispatchSaveAndCloseActivity();
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    const shareHeaderId = !state.shareState?.url ? state.shareState?.headerId : undefined;

    if (!state || !state.editorView) return {
        shareHeaderId
    };

    const { currentActivityId, currentMapId, currentHeaderId, state: saveState, allowCodeCarryover, previousHeaderId } = state.editorView;

    let title: string | undefined;
    const map = state.maps[currentMapId];
    const activity = map?.activities[currentActivityId] as MapActivity;

    title = activity?.displayName;

    const progress = lookupActivityProgress(state.user, state.pageSourceUrl, currentMapId, currentActivityId);

    return {
        tutorialPath: activity.url,
        title,
        mapId: currentMapId,
        activityId: currentActivityId,
        activityHeaderId: currentHeaderId,
        activityType: activity.type,
        carryoverCode: allowCodeCarryover,
        previousHeaderId: previousHeaderId,
        progress,
        save: saveState === "saving",
        shareHeaderId
    }
}

function setElementVisible(selector: string, visible: boolean) {
    const el = document.querySelector(selector) as HTMLDivElement;
    if (el?.style) el.style.display = visible ? "" : "none";
}

const mapDispatchToProps = {
    dispatchSetHeaderIdForActivity,
    dispatchCloseActivity,
    dispatchSaveAndCloseActivity,
    dispatchUpdateUserCompletedTags,
    dispatchSetShareStatus
};

export const MakeCodeFrame = connect(mapStateToProps, mapDispatchToProps)(MakeCodeFrameImpl);