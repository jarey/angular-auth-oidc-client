import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigurationProvider } from '../config';
import { LoggerService } from '../logging/logger.service';
import { StoragePersistanceService } from '../storage';
import { TokenValidationService } from '../validation/token-validation.service';
import { AuthorizedState } from './authorized-state';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
    // event which contains the state
    private authStateInternal$ = new BehaviorSubject<AuthorizedState>(AuthorizedState.Unknown);
    private authorizedInternal$ = new BehaviorSubject<boolean>(false);
    private authState = AuthorizedState.Unknown;

    get authState$() {
        return this.authStateInternal$.asObservable();
    }

    get authorized$() {
        return this.authorizedInternal$.asObservable();
    }

    constructor(
        private storagePersistanceService: StoragePersistanceService,
        private loggerService: LoggerService,
        private readonly configurationProvider: ConfigurationProvider,
        private tokenValidationService: TokenValidationService
    ) {}

    setAuthorizedAndFireEvent(): void {
        // set the correct values in storage
        this.authState = AuthorizedState.Authorized;
        this.persistAuthStateInStorage(this.authState);
        this.authorizedInternal$.next(true);
    }

    setUnauthorizedAndFireEvent(): void {
        // set the correct values in storage
        this.authState = AuthorizedState.Unauthorized;
        this.storagePersistanceService.resetAuthStateInStorage();
        this.authorizedInternal$.next(false);
    }

    initStateFromStorage(): void {
        const currentAuthorizedState = this.getCurrentlyPersistedAuthState();
        if (currentAuthorizedState === AuthorizedState.Authorized) {
            this.authState = AuthorizedState.Authorized;
        } else {
            this.authState = AuthorizedState.Unknown;
        }
    }

    setAuthorizationData(accessToken: any, idToken: any) {
        this.loggerService.logDebug(accessToken);
        this.loggerService.logDebug(idToken);
        this.loggerService.logDebug('storing to storage, getting the roles');

        this.storagePersistanceService.accessToken = accessToken;
        this.storagePersistanceService.idToken = idToken;

        this.setAuthorizedAndFireEvent();
    }

    getAccessToken(): string {
        if (!(this.authState === AuthorizedState.Authorized)) {
            return '';
        }

        const token = this.storagePersistanceService.getAccessToken();
        return decodeURIComponent(token);
    }

    getIdToken(): string {
        if (!(this.authState === AuthorizedState.Authorized)) {
            return '';
        }

        const token = this.storagePersistanceService.getIdToken();
        return decodeURIComponent(token);
    }

    getRefreshToken(): string {
        if (!(this.authState === AuthorizedState.Authorized)) {
            return '';
        }

        const token = this.storagePersistanceService.getRefreshToken();
        return decodeURIComponent(token);
    }

    validateStorageAuthTokens() {
        const currentAuthState = this.getCurrentlyPersistedAuthState();

        if (currentAuthState !== AuthorizedState.Authorized) {
            return false;
        }

        this.loggerService.logDebug(`authorizedState in storage is ${currentAuthState}`);

        if (this.tokenIsExpired()) {
            this.loggerService.logDebug('persisted token is expired');
            return false;
        } else {
            this.loggerService.logDebug('persisted token is valid');
            this.setAuthorizedAndFireEvent();
            return true;
        }
    }

    setAuthResult(authResult: any) {
        this.storagePersistanceService.authResult = authResult;
    }

    private getCurrentlyPersistedAuthState() {
        return this.storagePersistanceService.authorizedState;
    }

    private persistAuthStateInStorage(authState: AuthorizedState) {
        this.storagePersistanceService.authorizedState = authState;
    }

    private tokenIsExpired() {
        const tokenToCheck = this.storagePersistanceService.idToken || this.storagePersistanceService.accessToken;
        return this.tokenValidationService.isTokenExpired(
            tokenToCheck,
            this.configurationProvider.openIDConfiguration.silentRenewOffsetInSeconds
        );
    }
}