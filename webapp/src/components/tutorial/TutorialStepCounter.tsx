import * as React from "react";

interface TutorialStepCounterProps {
    currentStep: number;
    totalSteps: number;
    title?: string;
    setTutorialStep: (step: number) => void;
}

export function TutorialStepCounter(props: TutorialStepCounterProps) {
    const { currentStep, totalSteps, title } = props;

    const handleStepBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const { totalSteps, setTutorialStep } = props;
        const target = e.target as HTMLDivElement;
        const rect = target.getBoundingClientRect();

        setTutorialStep(Math.floor(((e.clientX - rect.left) / target.clientWidth) * totalSteps));
    }

    return <div className="tutorial-step-counter">
        <div className="tutorial-step-label">
            <span className="tutorial-step-title">{title || lf("Step")}</span>
            <span className="tutorial-step-number">{`${currentStep + 1}/${totalSteps}`}</span>
        </div>
        <div className="tutorial-step-bar" onClick={handleStepBarClick}>
            <div className="tutorial-step-bar-fill" style={{ width: ((currentStep + 1) / totalSteps) * 100 + "%" }} />
        </div>
    </div>
}