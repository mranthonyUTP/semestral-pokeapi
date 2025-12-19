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

function normalizeQuery(q) {
  return q.trim().toLowerCase();
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
  renderEvolutionUI(p);

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
  try {
    const data = await fetchPokemon(q);
    renderPokemon(data);
  } catch (e) {
    showError("NO ENCONTRADO. INTENTA OTRO NOMBRE O ID.");
  }
}

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

