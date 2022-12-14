/// <reference path="../../built/pxtrunner.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
// eslint-disable-next-line import/no-unassigned-import
import "./index.css";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";

const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;

pxt.setAppTarget(bundle);
pxt.setupWebConfig(pxt.webConfig);
// todo: handle this better?
if (pxt.BrowserUtils.isLocalHostDev()) {
    // patch webconfig to refer to pxt serve instead of multiplayer serve
    const wc = pxt.webConfig as any;

    for (const key of Object.keys(wc)) {
        if (wc[key]?.startsWith("/")) {
            wc[key] = `http://localhost:3232${wc[key]}`;
        }
    }
}
pxt.Cloud.apiRoot = "https://www.makecode.com/api/";
// pxt.reloadAppTargetVariant();
pxt.runner.initHost();

ReactDOM.render(
    <React.StrictMode>
        <AppStateProvider>
            <App />
        </AppStateProvider>
    </React.StrictMode>,
    document.getElementById("root")
);
