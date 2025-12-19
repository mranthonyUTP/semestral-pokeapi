/* =========================================================
   VS.JS — ARCHIVO ÚNICO Y LIMPIO
   - Cache con TTL
   - Indicador API / CACHÉ
   - Favoritos
   - VS reutilizable (sin duplicados)
========================================================= */

// ================= CONFIGURACIÓN =================
const CACHE_KEY = "poke_cache";
const FAVORITES_KEY = "pokemon_favorites";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// ================= DOM =================
const input1 = document.getElementById("vsInput1");
const input2 = document.getElementById("vsInput2");
const btn1 = document.getElementById("vsBtn1");
const btn2 = document.getElementById("vsBtn2");
const battleBtn = document.getElementById("battleBtn");
const resultBox = document.getElementById("vsResult");

// Card 1
const badge1 = document.getElementById("badge1");
const img1 = document.getElementById("img1");
const id1 = document.getElementById("id1");
const name1 = document.getElementById("name1");
const types1 = document.getElementById("types1");
const fav1 = document.getElementById("fav1");

// Card 2
const badge2 = document.getElementById("badge2");
const img2 = document.getElementById("img2");
const id2 = document.getElementById("id2");
const name2 = document.getElementById("name2");
const types2 = document.getElementById("types2");
const fav2 = document.getElementById("fav2");

let P1 = null;
let P2 = null;

// ================= UTILIDADES =================
function normalize(q){ return (q || "").trim().toLowerCase(); }

function readLS(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeLS(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

// ================= CACHE (TTL) =================
function getCachedPokemon(query){
  const cache = readLS(CACHE_KEY, {});
  const key = normalize(query);
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL){
    delete cache[key];
    writeLS(CACHE_KEY, cache);
    return null;
  }
  return entry.data;
}

function saveToCache(query, data){
  const cache = readLS(CACHE_KEY, {});
  const entry = { data, timestamp: Date.now() };
  cache[normalize(query)] = entry;
  cache[String(data.id)] = entry;
  cache[data.name] = entry;
  writeLS(CACHE_KEY, cache);
}

async function fetchPokemon(query){
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("notfound");
  return res.json();
}

async function fetchSmart(query){
  const cached = getCachedPokemon(query);
  if (cached) return { data: cached, source: "cache" };
  const data = await fetchPokemon(query);
  saveToCache(query, data);
  return { data, source: "api" };
}

// ================= FAVORITOS =================
function getFavorites(){ return readLS(FAVORITES_KEY, []); }
function isFavorite(id){ return getFavorites().some(p => p.id === id); }

function toggleFavorite(pokemon){
  const favs = getFavorites();
  const idx = favs.findIndex(p => p.id === pokemon.id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push({
    id: pokemon.id,
    name: pokemon.name,
    img: pokemon.sprites?.front_default || pokemon.sprites?.other?.["official-artwork"]?.front_default || "",
    types: pokemon.types.map(t => t.type.name),
    at: Date.now()
  });
  writeLS(FAVORITES_KEY, favs);
}

// ================= RENDER MINI CARD =================
function renderMini(pokemon, source, ui){
  const sprite =
    pokemon.sprites?.front_default ||
    pokemon.sprites?.other?.["official-artwork"]?.front_default ||
    "";

  ui.img.src = sprite;
  ui.id.textContent = `#${pokemon.id}`;
  ui.name.textContent = pokemon.name.toUpperCase();

  ui.types.innerHTML = "";
  pokemon.types.forEach(t => {
    const span = document.createElement("span");
    span.className = "mini-type";
    span.textContent = t.type.name.toUpperCase();
    ui.types.appendChild(span);
  });

  ui.badge.classList.remove("cache");
  if (source === "cache"){
    ui.badge.textContent = "💾 CACHÉ";
    ui.badge.classList.add("cache");
  } else {
    ui.badge.textContent = "🌐 API";
  }

  const favState = isFavorite(pokemon.id);
  ui.fav.classList.toggle("fav", favState);
  ui.fav.textContent = favState ? "♥" : "♡";
  ui.fav.onclick = () => {
    toggleFavorite(pokemon);
    const nowFav = isFavorite(pokemon.id);
    ui.fav.classList.toggle("fav", nowFav);
    ui.fav.textContent = nowFav ? "♥" : "♡";
  };
}

// ================= BATALLA =================
function readyBattle(){
  const ready = P1 && P2;
  battleBtn.disabled = !ready;
  battleBtn.classList.toggle("ready", ready);
  if (!ready) resultBox.textContent = "";
}

function totalStats(p){ return p.stats.reduce((a,s)=>a+s.base_stat,0); }

// ================= EVENTOS =================
btn1.addEventListener("click", async (e) => {
  e.preventDefault();
  const q = normalize(input1.value);
  if (!q) return;
  try{
    const { data, source } = await fetchSmart(q);
    P1 = data;
    resultBox.textContent = "";
    renderMini(data, source, { badge: badge1, img: img1, id: id1, name: name1, types: types1, fav: fav1 });
    readyBattle();
  }catch{
    alert("Pokémon 1 no encontrado");
  }
});

btn2.addEventListener("click", async (e) => {
  e.preventDefault();
  const q = normalize(input2.value);
  if (!q) return;
  try{
    const { data, source } = await fetchSmart(q);
    P2 = data;
    resultBox.textContent = "";
    renderMini(data, source, { badge: badge2, img: img2, id: id2, name: name2, types: types2, fav: fav2 });
    readyBattle();
  }catch{
    alert("Pokémon 2 no encontrado");
  }
});

battleBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!P1 || !P2) return;
  const t1 = totalStats(P1);
  const t2 = totalStats(P2);
  if (t1 > t2) resultBox.textContent = `🏆 GANA ${P1.name.toUpperCase()} (${t1} vs ${t2})`;
  else if (t2 > t1) resultBox.textContent = `🏆 GANA ${P2.name.toUpperCase()} (${t2} vs ${t1})`;
  else resultBox.textContent = `🤝 EMPATE (${t1} vs ${t2})`;
});
