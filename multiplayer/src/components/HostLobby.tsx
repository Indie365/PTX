import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import { makeJoinLink, SHORT_LINK } from "../util";
import CopyButton from "./CopyButton";
import Loading from "./Loading";
import PresenceBar from "./PresenceBar";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);

    const onStartGameClick = async () => {
        pxt.tickEvent("mp.hostlobby.startgame");
        dispatch(clearModal());
        await startGameAsync();
    };

    const joinCode = state.gameState?.joinCode;
    if (!joinCode) {
        return <Loading />;
    }

    const displayJoinCode = joinCode?.slice(0, 3) + " " + joinCode?.slice(3);
    const inviteString = lf("Go to {0} and enter code", SHORT_LINK());
    const joinDeepLink = makeJoinLink(joinCode);

    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
            <div className="tw-mt-3 tw-text-lg tw-text-center tw-text-neutral-700">
                {inviteString}
            </div>
            <div className="tw-text-4xl tw-mt-4 tw-flex tw-flex-row tw-items-center">
                {displayJoinCode}
                <div className="tw-ml-2 tw-text-[75%]">
                    <CopyButton
                        copyValue={joinDeepLink}
                        title={lf("Copy join link")}
                        eventName="mp.hostlobby.copyjoinlink"
                    />
                </div>
            </div>
            <Button
                className={"primary tw-mt-5 tw-mb-7"}
                label={lf("Start Game")}
                title={lf("Start Game")}
                onClick={onStartGameClick}
            />
            <PresenceBar />
        </div>
    );
}
