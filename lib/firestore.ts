import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Player = {
  id: string;
  name: string;
};

export type Serving = {
  personId: string;
  cups: number;
};

export type DrinkLog = {
  id: string;
  name: string;
  photo?: string;
  tastedAt?: string;
  memo?: string;
  servings: Serving[];
};

export type AppState = {
  players: Player[];
  drinks: DrinkLog[];
};

const ROOM_ID = "default-room";

export function subscribeChallenge(callback: (data: AppState | null) => void) {
  const ref = doc(db, "challenges", ROOM_ID);

  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as AppState);
    } else {
      callback(null);
    }
  });
}

export async function saveChallenge(data: AppState) {
  const ref = doc(db, "challenges", ROOM_ID);
  await setDoc(ref, data);
}

export async function getChallengeOnce() {
  const ref = doc(db, "challenges", ROOM_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as AppState;
}