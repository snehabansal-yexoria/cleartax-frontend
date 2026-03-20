import { userPool } from "./cognito";

export function logout() {
  const user = userPool.getCurrentUser();

  if (user) {
    user.signOut();
  }

  document.cookie = "idToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
