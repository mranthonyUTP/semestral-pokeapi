const input = document.querySelector(".search-input");
const btn = document.querySelector(".search-button");
const typeBtnOrSelect = document.querySelector(".search-type"); // puede ser button o select

const resultCard = document.getElementById("resultCard");
const resultError = document.getElementById("resultError");
const pokeImg = document.getElementById("pokeImg");
const pokeName = document.getElementById("pokeName");
const pokeId = document.getElementById("pokeId");
const pokeTypes = document.getElementById("pokeTypes");
const pokeMeta = document.getElementById("pokeMeta");

const CACHE_KEY = "poke_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

function normalizeQuery(q) {
  return q.trim().toLowerCase();
}

// Funciones de caché
function getCachedPokemon(query) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  const normalized = normalizeQuery(query);
  const cached = cache[normalized];
  
  if (!cached) return null;
  
  // Verificar si el caché ha expirado
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    // Eliminar del caché si expiró
    delete cache[normalized];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return null;
  }
  
  return cached.data;
}

function saveToCache(query, data) {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  const normalized = normalizeQuery(query);
  
  cache[normalized] = {
    data: data,
    timestamp: Date.now()
  };
  
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// Limpiar entradas expiradas del caché
function cleanExpiredCache() {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  const now = Date.now();
  let hasChanges = false;
  
  for (const key in cache) {
    if (now - cache[key].timestamp > CACHE_TTL) {
      delete cache[key];
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }
}

function updateBadge(source) {
  const badge = document.querySelector(".badge-cyan");
  if (badge) {
    if (source === "cache") {
      badge.textContent = "💾 DESDE CACHÉ";
      badge.style.background = "#f4d35e";
      badge.style.color = "#111";
    } else {
      badge.textContent = "🌐 DESDE API";
      badge.style.background = "#42EBE7";
      badge.style.color = "#111";
    }
  }
}

function showError(msg) {
  resultCard.hidden = true;
  resultError.hidden = false;
  resultError.textContent = msg;
}

function showCard() {
  resultError.hidden = true;
  resultCard.hidden = false;
}

function saveHistory(item) {
  const key = "poke_history";
  const prev = JSON.parse(localStorage.getItem(key) || "[]");
  // evita duplicados seguidos
  if (prev.length && prev[0].id === item.id) return;
  prev.unshift(item);
  localStorage.setItem(key, JSON.stringify(prev.slice(0, 25)));
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function setBar(id, value, max=200){
  const pct = Math.min(100, (value / max) * 100);
  document.getElementById(id).style.width = pct + "%";
}

function renderPokemon(p){
  // imagen (puedes cambiar a official-artwork si quieres)
  const img =
    p.sprites?.front_default ||
    p.sprites?.other?.["official-artwork"]?.front_default ||
    "";

  document.getElementById("pokeImg").src = img;

  document.getElementById("pokeNumber").textContent = `#${p.id}`;
  document.getElementById("pokeName").textContent = p.name.toUpperCase();

  // tipos
  const typesWrap = document.getElementById("pokeTypes");
  typesWrap.innerHTML = "";
  p.types.forEach(t=>{
    const chip = document.createElement("span");
    chip.className = "type-chip";
    chip.textContent = t.type.name.toUpperCase();
    typesWrap.appendChild(chip);
  });

  // habilidades (oculta en amarillo)
  const abWrap = document.getElementById("pokeAbilities");
  abWrap.innerHTML = "";
  p.abilities.forEach(a=>{
    const chip = document.createElement("span");
    const isHidden = a.is_hidden;
    chip.className = "ability-chip " + (isHidden ? "ability-yellow" : "ability-green");
    chip.textContent = isHidden ? `${cap(a.ability.name)} (Oculta)` : cap(a.ability.name);
    abWrap.appendChild(chip);
  });

  // stats
  const map = Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]));
  setBar("bar-hp", map["hp"] || 0);
  setBar("bar-attack", map["attack"] || 0);
  setBar("bar-defense", map["defense"] || 0);
  setBar("bar-spa", map["special-attack"] || 0);
  setBar("bar-spd", map["special-defense"] || 0);
  setBar("bar-speed", map["speed"] || 0);

  // mostrar
  document.getElementById("resultError").hidden = true;
  document.getElementById("resultCard").hidden = false;
}


async function fetchPokemon(query) {
  const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("notfound");
  return res.json();
}

async function onSearch() {
  const q = normalizeQuery(input.value);
  if (!q) return showError("ESCRIBE UN NOMBRE O ID.");
  
  // Verificar caché primero
  const cached = getCachedPokemon(q);
  if (cached) {
    renderPokemon(cached);
    updateBadge("cache");
    saveHistory({ id: cached.id, name: cached.name });
    return;
  }
  
  // Si no está en caché, hacer petición a la API
  try {
    const data = await fetchPokemon(q);
    // Guardar en caché
    saveToCache(q, data);
    renderPokemon(data);
    updateBadge("api");
    saveHistory({ id: data.id, name: data.name });
  } catch (e) {
    showError("NO ENCONTRADO. INTENTA OTRO NOMBRE O ID.");
  }
}

// Limpiar caché expirado al cargar la página
cleanExpiredCache();

btn.addEventListener("click", onSearch);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSearch();
});

