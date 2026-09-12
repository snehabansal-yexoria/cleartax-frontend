import { userPool } from "./cognito";
import { resetAuthCache } from "./authToken";
import { clearSessionBootstrap } from "./sessionBootstrap";

export function logout() {
  // Drop the memoised session first so nothing that runs between here and the
  // redirect can hand out the departing user's token from memory.
  resetAuthCache();

  const user = userPool.getCurrentUser();

  if (user) {
    user.signOut();
  }

  document.cookie = "idToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = "role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  clearSessionBootstrap();
}
