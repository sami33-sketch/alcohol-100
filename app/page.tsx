"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { displayFont } from "./fonts";
import {
  getChallengeOnce,
  saveChallenge,
  subscribeChallenge,
  type AppState,
  type DrinkLog,
  type Player,
} from "@/lib/firestore";

type TabKey = "live" | "rank" | "drinks" | "add" | "players";

const defaultPlayers: Player[] = [
  { id: "p1", name: "しいな" },
  { id: "p2", name: "りく" },
  { id: "p3", name: "あすか" },
  { id: "p4", name: "さみ" },
];

const initialDrinks: DrinkLog[] = [
  {
    id: "d1",
    name: "ジントニック",
    tastedAt: "2026-04-04T20:10",
    memo: "開幕の1杯",
    servings: [
      { personId: "p4", cups: 2 },
      { personId: "p1", cups: 1 },
    ],
  },
  {
    id: "d2",
    name: "レモンサワー",
    tastedAt: "2026-04-04T20:35",
    memo: "写真映え担当",
    servings: [
      { personId: "p2", cups: 2 },
      { personId: "p4", cups: 1 },
    ],
  },
];

const initialState: AppState = {
  players: defaultPlayers,
  drinks: initialDrinks,
};

function levelLabel(cups: number) {
  if (cups >= 20) return "酒神 Lv.5";
  if (cups >= 14) return "酒豪 Lv.4";
  if (cups >= 9) return "酒強 Lv.3";
  if (cups >= 5) return "酒雑魚 Lv.2";
  if (cups >= 1) return "下戸 Lv.1";
  return "待機中";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${displayFont.className} inline-flex rounded-full border border-[#c89b53] bg-[#fff3d9] px-3 py-1 text-xs font-bold tracking-[0.08em] text-[#7a1f1f]`}
    >
      {children}
    </div>
  );
}

function tabButtonClass(active: boolean) {
  return active
    ? "bg-[#b22c1d] text-[#fff7e6]"
    : "border border-[#8f6232] bg-[#f6e7c8] text-[#5a241b]";
}

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const didInitRef = useRef(false);

  const [tab, setTab] = useState<TabKey>("live");
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [state, setState] = useState<AppState>(initialState);

  const [form, setForm] = useState({
    name: "",
    tastedAt: "",
    memo: "",
    personId: defaultPlayers[0].id,
    cups: 1,
    photo: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    tastedAt: "",
    memo: "",
    personId: "",
    cups: 1,
    photo: "",
  });

useEffect(() => {
  const init = async () => {
    const existing = await getChallengeOnce();
    if (!existing && !didInitRef.current) {
      didInitRef.current = true;
      await saveChallenge(initialState);
    }
  };

  init();

const unsubscribe = subscribeChallenge((data) => {
  if (data) {
    setState(data);
    setForm((prev) => ({
      ...prev,
      personId: data.players[0]?.id ?? prev.personId,
    }));
  }

  // ← これを外に出す
  setReady(true);
});

return () => unsubscribe();
}, []);

  function getPlayerName(personId: string) {
    return state.players.find((p) => p.id === personId)?.name ?? "不明";
  }

  const uniqueDrinkNames = useMemo(() => {
    return Array.from(new Set(state.drinks.map((drink) => drink.name.trim()).filter(Boolean)));
  }, [state.drinks]);

  const totalUnique = uniqueDrinkNames.length;

  const totalCups = state.drinks.reduce(
    (sum, drink) => sum + drink.servings.reduce((inner, serving) => inner + serving.cups, 0),
    0
  );

  const progress = Math.min(100, totalUnique);

  const ranking = useMemo(() => {
    return state.players
      .map((player) => {
        const cups = state.drinks.reduce((sum, drink) => {
          const found = drink.servings.find((s) => s.personId === player.id);
          return sum + (found?.cups || 0);
        }, 0);

        const unique = state.drinks.filter((drink) =>
          drink.servings.some((s) => s.personId === player.id)
        ).length;

        return {
          playerId: player.id,
          playerName: player.name,
          cups,
          unique,
          level: levelLabel(cups),
        };
      })
      .sort((a, b) => b.cups - a.cups || b.unique - a.unique);
  }, [state.drinks, state.players]);

  const leader = ranking[0];

  const filteredDrinks = useMemo(() => {
    const q = query.toLowerCase();
    return state.drinks.filter((drink) => {
      const text = [
        drink.name,
        drink.memo ?? "",
        ...drink.servings.map((s) => `${getPlayerName(s.personId)} ${s.cups}`),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [query, state.drinks, state.players]);

  async function persist(nextState: AppState) {
    try {
      setSaving(true);
      await saveChallenge(nextState);
    } finally {
      setSaving(false);
    }
  }

  async function addCup(drinkId: string, personId: string) {
    const nextState: AppState = {
      ...state,
      drinks: state.drinks.map((drink) => {
        if (drink.id !== drinkId) return drink;

        const exists = drink.servings.find((s) => s.personId === personId);
        if (exists) {
          return {
            ...drink,
            servings: drink.servings.map((s) =>
              s.personId === personId ? { ...s, cups: s.cups + 1 } : s
            ),
          };
        }

        return {
          ...drink,
          servings: [...drink.servings, { personId, cups: 1 }],
        };
      }),
    };

    await persist(nextState);
  }

  async function deleteDrink(drinkId: string) {
    const nextState: AppState = {
      ...state,
      drinks: state.drinks.filter((drink) => drink.id !== drinkId),
    };

    if (editingDrinkId === drinkId) {
      setEditingDrinkId(null);
    }

    await persist(nextState);
  }

function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = (e) => {
    img.src = e.target?.result as string;
  };

  img.onload = () => {
    const canvas = document.createElement("canvas");

    // 👇 最大サイズ（ここで圧縮）
    const MAX_WIDTH = 800;
    const scale = MAX_WIDTH / img.width;

    canvas.width = MAX_WIDTH;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 👇 画質も圧縮（0.7くらいがちょうどいい）
    const compressed = canvas.toDataURL("image/jpeg", 0.7);

    setForm((prev) => ({
      ...prev,
      photo: compressed,
    }));
  };

  reader.readAsDataURL(file);
}

function handleEditPhotoUpload(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = (e) => {
    img.src = e.target?.result as string;
  };

  img.onload = () => {
    const canvas = document.createElement("canvas");

    const MAX_WIDTH = 800;
    const scale = MAX_WIDTH / img.width;

    canvas.width = MAX_WIDTH;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL("image/jpeg", 0.7);

    setEditForm((prev) => ({
      ...prev,
      photo: compressed,
    }));
  };

  reader.readAsDataURL(file);
}

  async function addDrink() {
  if (!form.name.trim()) return;
  if (!state.players.length) return;

  const newDrink: DrinkLog = {
    id: crypto.randomUUID(),
    name: form.name.trim(),
    tastedAt: form.tastedAt,
    memo: form.memo,
    photo: form.photo,

    servings: [{ personId: form.personId, cups: Number(form.cups) || 1 }],
  };

  const nextState: AppState = {
    ...state,
    drinks: [newDrink, ...state.drinks],
  };

  await persist(nextState);

  setForm({
    name: "",
    tastedAt: "",
    memo: "",
    personId: state.players[0]?.id ?? "",
    cups: 1,
    photo: "",
  });

  setTab("live");
}

  function startEditDrink(drink: DrinkLog) {
    setEditingDrinkId(drink.id);
    setEditForm({
      name: drink.name,
      tastedAt: drink.tastedAt ?? "",
      memo: drink.memo ?? "",
      personId: drink.servings[0]?.personId ?? state.players[0]?.id ?? "",
      cups: drink.servings[0]?.cups ?? 1,
      photo: drink.photo ?? "",
    });
  }

  async function saveEditDrink() {
    if (!editingDrinkId) return;
    if (!editForm.name.trim()) return;

    const nextState: AppState = {
      ...state,
      drinks: state.drinks.map((drink) => {
        if (drink.id !== editingDrinkId) return drink;

        return {
          ...drink,
          name: editForm.name.trim(),
          tastedAt: editForm.tastedAt,
          memo: editForm.memo,
          photo: editForm.photo,
          servings: [{ personId: editForm.personId, cups: Number(editForm.cups) || 1 }],
        };
      }),
    };

    await persist(nextState);
    setEditingDrinkId(null);
  }

  function cancelEditDrink() {
    setEditingDrinkId(null);
  }

  async function addPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
    };

    const nextState: AppState = {
      ...state,
      players: [...state.players, newPlayer],
    };

    await persist(nextState);
    setNewPlayerName("");
  }

  async function deletePlayer(playerId: string) {
    const used = state.drinks.some((drink) =>
      drink.servings.some((serving) => serving.personId === playerId)
    );

    if (used) {
      alert("この参加者は飲酒記録に使われているので削除できません。先に記録を削除してください。");
      return;
    }

    const nextPlayers = state.players.filter((player) => player.id !== playerId);

    const nextState: AppState = {
      ...state,
      players: nextPlayers,
    };

    await persist(nextState);

    setForm((prev) => ({
      ...prev,
      personId: nextPlayers[0]?.id ?? "",
    }));
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#ebe7e3] p-6 text-[#3b2416]">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#ebe7e3] pb-28 text-[#3b2416]">
      <div className="mx-auto max-w-5xl p-4">
        <div className="space-y-4">
          <section className="rounded-[32px] bg-[linear-gradient(135deg,#542614_0%,#2d140d_100%)] p-[2px]">
  <div className="rounded-[30px] bg-[linear-gradient(180deg,#7e231b_0%,#6d1f1b_40%,#5a1a17_100%)] px-4 py-4 text-[#fff3d9]">

    {/* 横並び */}
    <div className="flex items-center gap-3">

      {/* 左 */}
      <div className="flex-1">

        <div className="mb-1 flex gap-2 text-xl">
          🍺 🏮 🍶
        </div>

        <h1 className={`${displayFont.className} text-[1.6rem] leading-tight font-bold`}>
          100種類飲むまで
          <br />
          帰れません！
        </h1>

        <p className="mt-1 text-xs">
          〜酒飲めるやつが1番偉い〜
        </p>

      </div>

      {/* 右 */}
      <div className="w-[110px] shrink-0">

        <div className="rounded-xl bg-[#f8dfb9]/10 p-2 text-center">
          <p className="text-[10px]">進捗</p>
          <p className="text-2xl font-black">{progress}</p>
          <p className="text-[10px]">/100</p>
        </div>

      </div>

    </div>

    {/* バー */}
    <div className="mt-3">
      <div className="flex justify-between text-[10px] mb-1">
        <span>{progress}%</span>
        <span>{totalCups}杯</span>
      </div>

      <div className="h-2 rounded-full bg-[#f7ddb3]/20">
        <div
          className="h-full rounded-full bg-[#ffe7b7]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>

    {/* 下 */}
    <div className="flex gap-2 mt-3 text-center">

  {/* 種類 */}
  <div className="flex-1 bg-[#8a3a2c] border border-[#f3c99b] rounded-xl p-2 flex flex-col justify-center h-[70px]">
    <p className="text-[10px] opacity-80">種類</p>
    <p className="text-lg font-bold leading-none mt-1">{totalUnique}</p>
  </div>

  {/* トップ */}
  <div className="flex-1 bg-[#8a3a2c] border border-[#f3c99b] rounded-xl p-2 flex flex-col justify-center h-[70px]">
    <p className="text-[10px] opacity-80">トップ</p>
    <p className="text-lg font-bold leading-none mt-1 truncate">
      {leader?.playerName}
    </p>
  </div>

  {/* レベル */}
  <div className="flex-1 bg-[#8a3a2c] border border-[#f3c99b] rounded-xl p-2 flex flex-col justify-center h-[70px]">
    <p className="text-[10px] opacity-80">Lv</p>
    <p className="text-sm font-bold leading-tight mt-1">
      {leader?.level}
    </p>
  </div>

</div>

  </div>
</section>


          {tab === "live" && (
            <section className="space-y-3">
              <div className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-3 shadow-md">
                <div className="mb-2">
                  <SectionLabel>本日のお品書き 検索</SectionLabel>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="酒名・人名で検索"
                  className="w-full rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                />
              </div>

              {filteredDrinks.length === 0 && (
                <div className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 text-sm text-[#6a4a2d] shadow-md">
                  該当するお酒がありません
                </div>
              )}

              {filteredDrinks.map((drink) => (
                <article
                  key={drink.id}
                  className="overflow-hidden rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] shadow-md"
                >
                  {drink.photo ? (
                    <img src={drink.photo} alt={drink.name} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-[#ead5b2] text-[#6a4a2d]">
                      🍺 写真なし 🍶
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🍺</span>
                          <h3 className={`${displayFont.className} text-[26px] font-bold text-[#5a241b]`}>
                            {drink.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-[#7b5a3b]">{formatDate(drink.tastedAt)}</p>
                      </div>

                      <span className="rounded-full bg-[#7a1f1f] px-3 py-1 text-sm font-bold text-[#fff7e6]">
                        {drink.servings.reduce((sum, row) => sum + row.cups, 0)}杯
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {drink.servings.map((serving) => (
                        <span
                          key={serving.personId}
                          className="rounded-full bg-[#ead5b2] px-3 py-1 text-sm font-semibold text-[#5a241b]"
                        >
                          {getPlayerName(serving.personId)} {serving.cups}杯
                        </span>
                      ))}
                    </div>

                    {drink.memo && (
                      <p className="mt-3 text-sm leading-6 text-[#6a4a2d]">{drink.memo}</p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {state.players.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => addCup(drink.id, player.id)}
                          className="rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-3 py-3 text-sm font-semibold text-[#5a241b]"
                        >
                          {player.name} +1杯
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startEditDrink(drink)}
                        className="rounded-2xl bg-[#b22c1d] px-4 py-3 text-sm font-bold text-[#fff7e6]"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteDrink(drink.id)}
                        className="rounded-2xl bg-[#8b1e14] px-4 py-3 text-sm font-bold text-[#fff7e6]"
                      >
                        削除
                      </button>
                    </div>

                    {editingDrinkId === drink.id && (
                      <div className="mt-4 rounded-[24px] border border-[#c89b53] bg-[#fff8eb] p-3">
                        <p className="mb-3 text-sm font-bold text-[#5a241b]">編集</p>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="お酒の名前"
                            className="col-span-2 rounded-2xl border border-[#c89b53] bg-white px-4 py-3 outline-none"
                          />

                          <input
                            type="datetime-local"
                            value={editForm.tastedAt}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, tastedAt: e.target.value }))
                            }
                            className="col-span-2 rounded-2xl border border-[#c89b53] bg-white px-4 py-3 outline-none"
                          />

                          <select
                            value={editForm.personId}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, personId: e.target.value }))
                            }
                            className="rounded-2xl border border-[#c89b53] bg-white px-4 py-3 outline-none"
                          >
                            {state.players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.name}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="1"
                            value={editForm.cups}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                cups: Number(e.target.value),
                              }))
                            }
                            className="rounded-2xl border border-[#c89b53] bg-white px-4 py-3 outline-none"
                          />
                        </div>

                        <textarea
                          value={editForm.memo}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, memo: e.target.value }))
                          }
                          placeholder="メモ"
                          className="mt-3 min-h-[90px] w-full rounded-2xl border border-[#c89b53] bg-white px-4 py-3 outline-none"
                        />

                        <div className="mt-3 rounded-[24px] border border-dashed border-[#c89b53] bg-[#f6e7c8] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[#5a241b]">写真を変更</p>
                              <p className="text-xs text-[#7b5a3b]">端末から選び直せます</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => editFileInputRef.current?.click()}
                              className="rounded-2xl border border-[#c89b53] bg-white px-4 py-2 text-sm text-[#5a241b]"
                            >
                              選ぶ
                            </button>
                          </div>

                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleEditPhotoUpload}
                          />

                          {editForm.photo ? (
                            <img
                              src={editForm.photo}
                              alt="edit preview"
                              className="mt-3 h-40 w-full rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="mt-3 flex h-32 items-center justify-center rounded-2xl bg-[#ead5b2] text-sm text-[#6a4a2d]">
                              写真なし
                            </div>
                          )}

                          {editForm.photo && (
                            <button
                              type="button"
                              onClick={() => setEditForm((prev) => ({ ...prev, photo: "" }))}
                              className="mt-3 w-full rounded-2xl border border-[#c89b53] bg-white px-4 py-3 text-sm text-[#5a241b]"
                            >
                              写真を外す
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={saveEditDrink}
                            className="rounded-2xl bg-[#b22c1d] px-4 py-3 text-sm font-bold text-[#fff7e6]"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEditDrink}
                            className="rounded-2xl border border-[#c89b53] bg-white px-4 py-3 text-sm font-bold text-[#5a241b]"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          {tab === "rank" && (
            <section className="space-y-3">
              <div>
                <SectionLabel>本日の番付</SectionLabel>
              </div>
              {ranking.map((row, index) => (
                <article
                  key={row.playerId}
                  className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[#5a241b]">
                        {index + 1}. {row.playerName}
                      </p>
                      <p className="mt-1 text-sm text-[#7b5a3b]">
                        {row.level} ・ {row.unique}種類制覇
                      </p>
                    </div>
                    <p className="text-xl font-black text-[#7a1f1f]">{row.cups}杯</p>
                  </div>

                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ead5b2]">
                    <div
                      className="h-full rounded-full bg-[#b22c1d]"
                      style={{ width: `${Math.min(100, row.cups * 5)}%` }}
                    />
                  </div>
                </article>
              ))}
            </section>
          )}

          {tab === "drinks" && (
            <section className="space-y-3">
              <div className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 shadow-md">
                <div className="mb-3">
                  <SectionLabel>制覇した酒</SectionLabel>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#5a241b]">飲んだお酒一覧</p>
                    <p className="text-xs text-[#7b5a3b]">{totalUnique} / 100種類</p>
                  </div>
                  <div className="text-sm font-black text-[#7a1f1f]">
                    あと {Math.max(0, 100 - totalUnique)} 種類
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {uniqueDrinkNames.length > 0 ? (
                    uniqueDrinkNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-[#7a1f1f] px-3 py-2 text-sm font-semibold text-[#fff7e6]"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-[#7b5a3b]">まだお酒が登録されていません</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {tab === "add" && (
            <section className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 shadow-md">
              <div className="mb-3">
                <SectionLabel>新しい一杯</SectionLabel>
              </div>

              {state.players.length === 0 ? (
                <div className="rounded-2xl bg-[#fff1d6] p-4 text-sm text-[#8a5b22]">
                  先に参加者を追加してください
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="お酒の名前"
                      className="col-span-2 rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                    />

                    <input
                      type="datetime-local"
                      value={form.tastedAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, tastedAt: e.target.value }))}
                      className="col-span-2 rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                    />

                    <select
                      value={form.personId}
                      onChange={(e) => setForm((prev) => ({ ...prev, personId: e.target.value }))}
                      className="rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                    >
                      {state.players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={form.cups}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, cups: Number(e.target.value) }))
                      }
                      placeholder="杯数"
                      className="rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                    />
                  </div>

                  <textarea
                    value={form.memo}
                    onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                    placeholder="メモ"
                    className="mt-3 min-h-[90px] w-full rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                  />

                  <div className="mt-3 rounded-[24px] border border-dashed border-[#c89b53] bg-[#fff8eb] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#5a241b]">写真アップロード</p>
                        <p className="text-xs text-[#7b5a3b]">端末から直接追加</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-2xl border border-[#c89b53] bg-white px-4 py-2 text-sm text-[#5a241b]"
                      >
                        選ぶ
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    {form.photo ? (
                      <img
                        src={form.photo}
                        alt="preview"
                        className="mt-3 h-40 w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="mt-3 flex h-32 items-center justify-center rounded-2xl bg-[#ead5b2] text-sm text-[#6a4a2d]">
                        まだ写真は選ばれていません
                      </div>
                    )}

                    {form.photo && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, photo: "" }))}
                        className="mt-3 w-full rounded-2xl border border-[#c89b53] bg-white px-4 py-3 text-sm text-[#5a241b]"
                      >
                        写真を外す
                      </button>
                    )}
                  </div>

                  <button
                    onClick={addDrink}
                    className="mt-3 w-full rounded-2xl bg-[#b22c1d] px-4 py-3 text-base font-black text-[#fff7e6]"
                  >
                    このお酒を記録する
                  </button>
                </>
              )}
            </section>
          )}

          {tab === "players" && (
            <section className="space-y-3">
              <div className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 shadow-md">
                <div className="mb-3">
                  <SectionLabel>本日のメンバー</SectionLabel>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="名前を入力"
                    className="flex-1 rounded-2xl border border-[#c89b53] bg-[#fff8eb] px-4 py-3 outline-none"
                  />
                  <button
                    onClick={addPlayer}
                    className="rounded-2xl bg-[#b22c1d] px-4 py-3 text-sm font-bold text-[#fff7e6]"
                  >
                    追加
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {state.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 shadow-md"
                  >
                    <div>
                      <p className="font-black text-[#5a241b]">{player.name}</p>
                      <p className="text-xs text-[#7b5a3b]">
                        {ranking.find((r) => r.playerId === player.id)?.cups ?? 0}杯
                      </p>
                    </div>
                    <button
                      onClick={() => deletePlayer(player.id)}
                      className="rounded-2xl bg-[#8b1e14] px-4 py-2 text-sm font-bold text-[#fff7e6]"
                    >
                      削除
                    </button>
                  </div>
                ))}

                {state.players.length === 0 && (
                  <div className="rounded-[28px] border border-[#c89b53] bg-[#f6e7c8] p-4 text-sm text-[#7b5a3b] shadow-md">
                    参加者がまだいません
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-5xl border-t border-[#c89b53]/40 bg-[#4b2d1f]/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => setTab("live")}
            className={`${displayFont.className} rounded-2xl px-2 py-3 text-xs font-bold ${tabButtonClass(
              tab === "live"
            )}`}
          >
            ライブ
          </button>

          <button
            onClick={() => setTab("rank")}
            className={`${displayFont.className} rounded-2xl px-2 py-3 text-xs font-bold ${tabButtonClass(
              tab === "rank"
            )}`}
          >
            順位
          </button>

          <button
            onClick={() => setTab("drinks")}
            className={`${displayFont.className} rounded-2xl px-2 py-3 text-xs font-bold ${tabButtonClass(
              tab === "drinks"
            )}`}
          >
            お酒一覧
          </button>

          <button
            onClick={() => setTab("add")}
            className={`${displayFont.className} rounded-2xl px-2 py-3 text-xs font-bold ${tabButtonClass(
              tab === "add"
            )}`}
          >
            追加
          </button>

          <button
            onClick={() => setTab("players")}
            className={`${displayFont.className} rounded-2xl px-2 py-3 text-xs font-bold ${tabButtonClass(
              tab === "players"
            )}`}
          >
            参加者
          </button>
        </div>
      </nav>
    </main>
  );
}