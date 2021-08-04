import { dispatchSetUserProfile, dispatchSetUserPreferences, dispatchLogout } from '../actions/dispatch';
import store from '../store/store';
import { getPageSourceUrl } from './browserUtils';
import { getFlattenedHeaderIds } from './skillMapUtils';

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {
        // When the user signs in, do some cloud syncing:
        // - Save any local projects that are part of the current skillmap to the cloud.
        // - Sync projects from remote.
        await this.cloudSyncAsync();
    }
    protected onSignedOut(): Promise<void> {
        // Show a notification?
        store.dispatch(dispatchLogout());
        return Promise.resolve();
    }
    protected onSignInFailed(): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }
    protected onUserProfileChanged(): Promise<void> {
        const state = this.getState();
        if (state.profile) {
            pxt.auth.generateUserProfilePicDataUrl(state.profile);
        }
        store.dispatch(dispatchSetUserProfile(state.profile));
        return Promise.resolve();
    }
    protected onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        // TODO: Dispatch individual preference fields individually (if changed): language, highContrast, etc.
        return Promise.resolve();
    }
    protected onStateCleared(): Promise<void> {
        return Promise.resolve();
    }
    protected onProfileDeleted(userId: string): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }
    protected onApiError(err: any): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }

    private async cloudSyncAsync() {
        const user = (await this.userPreferencesAsync())?.skillmap as UserState;
        if (user) {
            const headerIds = getFlattenedHeaderIds(user, getPageSourceUrl());
        }
    }
}

async function clientAsync(): Promise<AuthClient | undefined> {
    if (!pxt.auth.hasIdentity()) { return undefined; }
    let cli = pxt.auth.client();
    if (cli) { return cli as AuthClient; }
    cli = new AuthClient();
    await cli.initAsync();
    return cli as AuthClient;
}

export async function authCheckAsync() {
    const cli = await clientAsync();
    await cli?.authCheckAsync();
}

export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
    return await pxt.auth.loginCallbackAsync(qs);
}

export async function saveSkillmapStateAsync(state: pxt.auth.UserSkillmapState): Promise<void> {
    const cli = await clientAsync();
    await cli?.patchUserPreferencesAsync({
        op: 'replace',
        path: ['skillmap'],
        value: state
    });
}

export async function getSkillmapStateAsync(): Promise<pxt.auth.UserSkillmapState | undefined> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        return prefs?.skillmap;
    }
}
