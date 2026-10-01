import { loadPersistedState, persistState } from './persistState';
import { createAppStore } from './store';

export { createAppStore, type AppStore } from './store';

export const store = createAppStore(loadPersistedState());
persistState(store);
