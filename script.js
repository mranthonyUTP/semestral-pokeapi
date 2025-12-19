const input = document.querySelector(".search-input");
const btn = document.querySelector(".search-button");
const typeBtnOrSelect = document.querySelector(".search-type"); // puede ser button o select
const FAVORITES_KEY = "pokemon_favorites";
const resultCard = document.getElementById("resultCard");
const resultError = document.getElementById("resultError");
const pokeImg = document.getElementById("pokeImg");
const pokeName = document.getElementById("pokeName");
const pokeId = document.getElementById("pokeId");
const pokeTypes = document.getElementById("pokeTypes");
const pokeMeta = document.getElementById("pokeMeta");

const CACHE_KEY = "poke_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
let currentPokemon = null;

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
  // mantener referencia del Pokémon actual
  currentPokemon = p;
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
  renderEvolutionUI(p);

  // actualizar estado del botón de favorito dentro de la tarjeta
  const favBtnEl = document.getElementById("favBtn");
  if (favBtnEl) favBtnEl.textContent = isFavorite(p.id) ? "❤️" : "🤍";

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
// --- Evoluciones: obtiene species -> evolution_chain -> parse chain ---

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error("fetch_failed");
  return res.json();
}

function formatEvolutionDetails(details){
  if(!details || !details.length) return "Evolución";

  // normalmente viene un array; usamos el primero como resumen
  const d = details[0];

  // Nivel
  if (d.min_level != null) return `Nivel ${d.min_level}`;

  // Item
  if (d.item?.name) return `Usar ${d.item.name.replaceAll("-", " ")}`;

  // Felicidad
  if (d.min_happiness != null) return `Felicidad ${d.min_happiness}+`;

  // Tiempo del día
  if (d.time_of_day) return `De ${d.time_of_day}`;

  // Trigger (trade, level-up, use-item, etc.)
  if (d.trigger?.name) {
    const t = d.trigger.name;
    if (t === "trade") return "Intercambio";
    if (t === "use-item") return "Usar ítem";
    if (t === "level-up") return "Subir nivel";
    return t.replaceAll("-", " ");
  }

  return "Evolución";
}

function flattenEvolutionChain(chainNode){
  // convierte el árbol en una lista de "pasos" para renderizar con flechas
  // Ej: base -> (cond) -> evo1 -> (cond) -> evo2
  const steps = [];

  function walk(node){
    // nodo actual
    steps.push({
      name: node.species.name,
      detailsFromPrev: null, // lo llena el padre cuando agrega la flecha
    });

    // si tiene múltiples evoluciones, las renderizamos como ramas
    // aquí lo manejamos linealmente creando un “bloque” por cada evolución
    // (simple y funciona bien visualmente en wrap)
    node.evolves_to.forEach((child, idx) => {
      // agregamos flecha+condición antes del hijo
      steps.push({
        arrow: true,
        cond: formatEvolutionDetails(child.evolution_details),
      });

      walk(child);

      // si hay más de una rama, ponemos un separador visual
      if (idx < node.evolves_to.length - 1) {
        steps.push({ branch: true });
      }
    });
  }

  walk(chainNode);
  return steps;
}

async function getEvolutionChainForPokemon(pokemonNameOrId){
  // 1) species
  const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemonNameOrId)}`);
  // 2) evolution chain
  const evo = await fetchJSON(species.evolution_chain.url);
  return evo.chain; // raíz
}

async function getSpriteForName(name){
  // para sprite usamos /pokemon/{name}
  const p = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`);
  return p.sprites?.front_default || p.sprites?.other?.["official-artwork"]?.front_default || "";
}

async function renderEvolutionUI(currentPokemon){
  const evoWrap = document.getElementById("evoChain");
  if(!evoWrap) return;

  evoWrap.innerHTML = ""; // limpiar

  try{
    const chainRoot = await getEvolutionChainForPokemon(currentPokemon.name);
    const steps = flattenEvolutionChain(chainRoot);

    for (const s of steps){
      if (s.branch){
        // separador de ramas
        const sep = document.createElement("span");
        sep.className = "evo-arrow";
        sep.textContent = "OR";
        evoWrap.appendChild(sep);
        continue;
      }

      if (s.arrow){
        const arrow = document.createElement("span");
        arrow.className = "evo-arrow";
        arrow.textContent = "→";
        evoWrap.appendChild(arrow);

        const cond = document.createElement("span");
        cond.className = "evo-cond";
        cond.textContent = s.cond;
        evoWrap.appendChild(cond);
        continue;
      }

      // card pokemon
      const card = document.createElement("div");
      card.className = "evo-card";
      card.setAttribute("data-name", s.name);

      const img = document.createElement("img");
      img.className = "evo-sprite";
      img.alt = s.name;

      // sprite async
      getSpriteForName(s.name).then(url => { img.src = url; }).catch(()=>{ img.src=""; });

      const name = document.createElement("div");
      name.className = "evo-name";
      name.textContent = s.name;

      card.appendChild(img);
      card.appendChild(name);

      // click => buscar ese pokemon
      card.addEventListener("click", async () => {
        const input = document.querySelector(".search-input");
        if (input) input.value = s.name;
        // reutiliza tu flujo de búsqueda
        // si tienes onSearch() global, llámalo:
        if (typeof onSearch === "function") onSearch();
        else {
          // fallback: buscar directo
          const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(s.name)}`);
          renderPokemon(data);
          renderEvolutionUI(data);
        }
      });

      evoWrap.appendChild(card);
    }
  } catch(e){
    // si no tiene cadena o algo falla
    evoWrap.innerHTML = `<div class="result-meta">No se pudo cargar la línea evolutiva.</div>`;
  }
}

/* Obtener favoritos */
function getFavorites(){
  return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
}

/* Guardar favoritos */
function saveFavorites(list){
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
}

/* Verificar si ya es favorito */
function isFavorite(pokemonId){
  return getFavorites().some(p => p.id === pokemonId);
}

/* Toggle favorite for the currently displayed Pokémon */
function toggleFavoriteForCurrent(){
  if (!currentPokemon) return;
  const id = currentPokemon.id;
  if (isFavorite(id)) removeFavorite(id);
  else addFavoriteFromPokemon(currentPokemon);
  // actualizar botón en la tarjeta
  const favBtnEl = document.getElementById("favBtn");
  if (favBtnEl) favBtnEl.textContent = isFavorite(id) ? "❤️" : "🤍";
  // si la vista de favoritos está abierta, refrescarla
  const favContainer = document.getElementById("favoritesContainer");
  if (favContainer && !favContainer.hidden) renderFavoritesList();
}

function addFavoriteFromPokemon(p){
  const list = getFavorites();
  if (list.some(f => f.id === p.id)) return; // evitar duplicados
  const sprite = p.sprites?.front_default || p.sprites?.other?.["official-artwork"]?.front_default || "";
  const favObj = {
    id: p.id,
    name: String(p.name).toLowerCase(),
    number: p.id,
    sprite: sprite,
    types: p.types.map(t => t.type.name)
  };
  list.push(favObj);
  saveFavorites(list);
}

function removeFavorite(pokemonId){
  const list = getFavorites().filter(f => f.id !== pokemonId);
  saveFavorites(list);
  // si el Pokémon mostrado coincide, actualizar botón
  if (currentPokemon && currentPokemon.id === pokemonId){
    const favBtnEl = document.getElementById("favBtn");
    if (favBtnEl) favBtnEl.textContent = "🤍";
  }
}

function clearAllFavorites(){
  saveFavorites([]);
  const favContainer = document.getElementById("favoritesContainer");
  if (favContainer && !favContainer.hidden) renderFavoritesList();
  const favBtnEl = document.getElementById("favBtn");
  if (favBtnEl && currentPokemon) favBtnEl.textContent = isFavorite(currentPokemon.id) ? "❤️" : "🤍";
}

function renderFavoritesList(){
  const wrap = document.getElementById("favoritesList");
  if (!wrap) return;
  wrap.innerHTML = "";
  const list = getFavorites();
  if (!list.length){
    const empty = document.createElement("div");
    empty.className = "favorites-empty";
    empty.textContent = "NO HAY FAVORITOS";
    wrap.appendChild(empty);
    return;
  }

  list.forEach(f => {
    const card = document.createElement("div");
    card.className = "favorite-card";

    const img = document.createElement("img");
    img.className = "favorite-sprite";
    img.src = f.sprite || "";
    img.alt = f.name;

    const info = document.createElement("div");
    info.className = "favorite-info";

    const nameRow = document.createElement("div");
    nameRow.className = "favorite-name-row";

    const num = document.createElement("div");
    num.className = "favorite-number";
    num.textContent = `#${f.number}`;

    const name = document.createElement("div");
    name.className = "favorite-name";
    name.textContent = String(f.name).toUpperCase();

    nameRow.appendChild(num);
    nameRow.appendChild(name);

    const typesWrap = document.createElement("div");
    typesWrap.className = "favorite-types";
    f.types.forEach(t => {
      const tspan = document.createElement("div");
      tspan.className = "favorite-type-badge";
      tspan.textContent = t.toUpperCase();
      typesWrap.appendChild(tspan);
    });

    info.appendChild(nameRow);
    info.appendChild(typesWrap);

    const del = document.createElement("button");
    del.className = "favorite-delete-btn";
    del.textContent = "🗑️";
    del.addEventListener("click", () => {
      removeFavorite(f.id);
      renderFavoritesList();
    });

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(del);

    wrap.appendChild(card);
  });
}

/* UI: show/hide favorites view */
function showFavoritesView(){
  const favContainer = document.getElementById("favoritesContainer");
  if (!favContainer) return;
  // ocultar result card y errores
  const resultCardEl = document.getElementById("resultCard");
  const resultErrorEl = document.getElementById("resultError");
  if (resultCardEl) resultCardEl.hidden = true;
  if (resultErrorEl) resultErrorEl.hidden = true;
  favContainer.hidden = false;
  renderFavoritesList();
}

function hideFavoritesView(){
  const favContainer = document.getElementById("favoritesContainer");
  if (!favContainer) return;
  favContainer.hidden = true;
  const resultCardEl = document.getElementById("resultCard");
  if (resultCardEl) resultCardEl.hidden = currentPokemon ? false : true;
}

/* Attach UI listeners */
document.addEventListener("DOMContentLoaded", () => {
  const favNav = document.querySelector(".favoritos");
  if (favNav) favNav.addEventListener("click", showFavoritesView);

  const buscarNav = document.querySelector(".buscar-nav");
  if (buscarNav) buscarNav.addEventListener("click", hideFavoritesView);

  const favBtn = document.getElementById("favBtn");
  if (favBtn) favBtn.addEventListener("click", toggleFavoriteForCurrent);

  const clearAllBtn = document.getElementById("clearAllBtn");
  if (clearAllBtn) clearAllBtn.addEventListener("click", () => { clearAllFavorites(); renderFavoritesList(); });
});
