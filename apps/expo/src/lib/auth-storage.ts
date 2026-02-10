import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "supabase-session";

export async function saveSession(session: string) {
  await SecureStore.setItemAsync(SESSION_KEY, session);
}

export async function getSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function deleteSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
