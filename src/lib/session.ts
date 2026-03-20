import { userPool } from "./cognito";

export function getCurrentUser() {
  return userPool.getCurrentUser();
}

export function getSession() {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();

    if (!user) {
      resolve(null);
      return;
    }

    user.getSession((err: any, session: any) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(session);
    });
  });
}
