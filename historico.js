const HISTORY_KEY = "poke_history";
const FAVORITES_KEY = "pokemon_favorites";

function readLS(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeLS(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function getHistory(){ return readLS(HISTORY_KEY, []); }
function setHistory(list){ writeLS(HISTORY_KEY, list); }

function getFavorites(){ return readLS(FAVORITES_KEY, []); }
function setFavorites(list){ writeLS(FAVORITES_KEY, list); }

function isFavorite(id){ return getFavorites().some(p => p.id === id); }

function toggleFavorite(item){
  const favs = getFavorites();
  const idx = favs.findIndex(p => p.id === item.id);

  if (idx >= 0) favs.splice(idx, 1);
  else favs.push({ id:item.id, name:item.name, img:item.img, types:item.types, at:Date.now() });

  setFavorites(favs);
}

function removeFromHistory(id){
  setHistory(getHistory().filter(x => x.id !== id));
}

function clearHistory(){ setHistory([]); }

function renderHistory(){
  const list = document.getElementById("historyList");
  const history = getHistory();
  list.innerHTML = "";

  if (!history.length){
    list.innerHTML = `<div class="history-item"><div class="history-main"><div class="history-title">No hay histórico todavía</div></div></div>`;
    return;
  }

  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";

    const left = document.createElement("div");
    left.className = "history-sprite";
    // build image with fallbacks: prefer stored item.img, then official-artwork, then front sprite
    const imgEl = document.createElement('img');
    imgEl.alt = item.name || '';
    imgEl.loading = 'lazy';
    const fallback1 = item.img || '';
    const fallback2 = item.id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.id}.png` : '';
    const fallback3 = item.id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${item.id}.png` : '';
    // try stored image first
    imgEl.src = fallback1 || fallback2 || fallback3 || '';
    // on error, try next fallback
    imgEl.addEventListener('error', function onErr() {
      if (this.src === fallback1 && fallback2) { this.src = fallback2; return; }
      if ((this.src === fallback1 || this.src === fallback2) && fallback3) { this.src = fallback3; return; }
      // no image available -> remove src to hide broken icon
      this.removeAttribute('src');
      this.removeEventListener('error', onErr);
    });
    left.appendChild(imgEl);

    const main = document.createElement("div");
    main.className = "history-main";

    const title = document.createElement("div");
    title.className = "history-title";
    title.innerHTML = `<span>#${item.id}</span><span>${(item.name || "").toUpperCase()}</span>`;

    const types = document.createElement("div");
    types.className = "history-types";
    (item.types || []).forEach(t => {
      const pill = document.createElement("span");
      pill.className = "type-pill";
      pill.textContent = String(t).toUpperCase();
      types.appendChild(pill);
    });

    main.appendChild(title);
    main.appendChild(types);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const favBtn = document.createElement("button");
    favBtn.className = "action-btn btn-fav";
    favBtn.type = "button";
    favBtn.textContent = "❤";
    if (isFavorite(item.id)) favBtn.classList.add("is-fav");

    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(item);
      renderHistory();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "action-btn btn-del";
    delBtn.type = "button";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromHistory(item.id);
      renderHistory();
    });

    actions.appendChild(favBtn);
    actions.appendChild(delBtn);

    row.addEventListener("click", () => {
      localStorage.setItem("last_search", item.name);
      window.location.href = "index.html";
    });

    row.appendChild(left);
    row.appendChild(main);
    row.appendChild(actions);

    list.appendChild(row);
  });
}

document.getElementById("clearAllBtn").addEventListener("click", () => {
  clearHistory();
  renderHistory();
});

renderHistory();
