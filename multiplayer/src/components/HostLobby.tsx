import { useContext, useRef, useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";
import PresenceBar from "./PresenceBar";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const inviteString = lf("Invite anyone to join your game instantly. Just send them a link!");

    const onStartGameClick = async () => {
        pxt.tickEvent("mp.hostlobby.startgame");
        dispatch(clearModal());
        await startGameAsync();
    };

    const handleCopyClick = () => {
        pxt.tickEvent("mp.hostlobby.copyjoinlink");
        if (pxt.BrowserUtils.isIpcRenderer()) {
            if (inputRef.current) {
                setCopySuccessful(
                    pxt.BrowserUtils.legacyCopyText(inputRef.current)
                );
            }
        } else {
            navigator.clipboard.writeText(joinLink);
            setCopySuccessful(true);
        }
    };

    const handleCopyBlur = () => {
        setCopySuccessful(false);
    };

    const joinLink = `${state.gameState?.joinCode}`; // TODO multiplayer : create full link
    return (
        <div className="tw-flex tw-flex-col tw-gap-1 tw-items-center tw-justify-between tw-bg-white tw-py-[3rem] tw-px-[7rem] tw-shadow-lg tw-rounded-lg">
            <div className="tw-mt-3 tw-text-lg tw-text-center tw-text-neutral-700">
                {inviteString}
            </div>
            <div className="common-input-attached-button tw-mt-5 tw-w-full">
                <Input
                    ariaLabel={lf("join game link")}
                    handleInputRef={inputRef}
                    initialValue={joinLink}
                    readOnly={true}
                />
                <Button
                    className={copySuccessful ? "green" : "primary"}
                    title={lf("Copy link")}
                    label={copySuccessful ? lf("Copied!") : lf("Copy")}
                    leftIcon="fas fa-link"
                    onClick={handleCopyClick}
                    onBlur={handleCopyBlur}
                />
            </div>
            <Button
                className={"teal tw-m-5"}
                label={lf("Start Game")}
                title={lf("Start Game")}
                onClick={onStartGameClick}
            />
            <PresenceBar />
        </div>
    );
}
