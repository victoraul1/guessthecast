const state = {
  streak: 0,
  movies: [],
  people: [],
  queue: [],
  current: null,
  mediaType: 'movie',
  generation: 0,
  busy: true,
  dragStart: 0,
  dragX: 0,
  countdown: null,
  timeLeft: 3,
  transition: null
};

const el = {};
const $ = id => document.getElementById(id);
const shuffle = items => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

async function tmdb(endpoint, params = {}) {
  const url = new URL(API_CONFIG.baseUrl + endpoint);
  url.searchParams.set('api_key', API_CONFIG.apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`);
  return response.json();
}

async function loadPools() {
  const mediaType = state.mediaType;
  const moviePages = Array.from({ length: GAME_CONFIG.moviePages }, (_, i) => tmdb(`/${mediaType}/popular`, { page: i + 1 }));
  const peoplePages = Array.from({ length: GAME_CONFIG.peoplePages }, (_, i) => tmdb('/person/popular', { page: i + 1 }));
  const [movies, people] = await Promise.all([Promise.all(moviePages), Promise.all(peoplePages)]);
  state.movies = shuffle(movies.flatMap(page => page.results).filter(item => item.poster_path && (item.release_date || item.first_air_date)));
  state.people = shuffle(people.flatMap(page => page.results).filter(person => person.profile_path && person.known_for_department === 'Acting'));
  if (!state.movies.length || !state.people.length) throw new Error('TMDB did not return enough cast data.');
}

async function buildChallenge() {
  const mediaType = state.mediaType;
  while (state.movies.length) {
    const movie = state.movies.pop();
    const credits = await tmdb(`/${mediaType}/${movie.id}/credits`);
    const cast = credits.cast.filter(person => person.profile_path).slice(0, 18);
    if (cast.length < 4) continue;

    const shouldBeCorrect = Math.random() >= .5;
    let actor;
    if (shouldBeCorrect) {
      actor = cast[Math.floor(Math.random() * Math.min(cast.length, 10))];
    } else {
      const castIds = new Set(credits.cast.map(person => person.id));
      const candidates = state.people.filter(person => !castIds.has(person.id));
      if (!candidates.length) continue;
      actor = candidates[Math.floor(Math.random() * candidates.length)];
    }
    return {
      movie,
      actor,
      mediaType,
      isInCast: shouldBeCorrect,
      character: shouldBeCorrect ? (actor.character || '') : ''
    };
  }
  await loadPools();
  return buildChallenge();
}

async function fillQueue() {
  if (state.queue.length >= 2) return;
  const generation = state.generation;
  try {
    const challenge = await buildChallenge();
    if (generation !== state.generation) return;
    state.queue.push(challenge);
    if (state.queue.length < 2) fillQueue();
  } catch (error) {
    if (!state.current) showFatal(error);
  }
}

async function nextChallenge() {
  clearTransition();
  stopCountdown();
  state.busy = true;
  toggleAnswers(false);
  el.actorCard.hidden = true;
  el.placeholder.hidden = false;
  el.result.hidden = true;

  try {
    if (!state.queue.length) state.queue.push(await buildChallenge());
    state.current = state.queue.shift();
    fillQueue();
    renderChallenge(state.current);
  } catch (error) {
    showFatal(error);
  }
}

function renderChallenge(challenge) {
  const { movie, actor } = challenge;
  const title = getMediaTitle(movie);
  const date = movie.release_date || movie.first_air_date;
  el.title.textContent = title;
  el.year.textContent = `${date.slice(0, 4)} · One face. One decision.`;
  el.actorName.textContent = actor.name;
  el.photo.alt = `Portrait of ${actor.name}`;
  el.photo.onload = () => {
    if (challenge.mediaType !== state.mediaType) return;
    resetCard();
    el.placeholder.hidden = true;
    el.actorCard.hidden = false;
    state.busy = false;
    toggleAnswers(true);
    startCountdown();
  };
  el.photo.onerror = () => nextChallenge();
  el.photo.src = API_CONFIG.imageBaseUrl + actor.profile_path;
}

function answer(guess, direction, source = 'button') {
  if (state.busy || !state.current) return;
  stopCountdown();
  state.busy = true;
  toggleAnswers(false);
  const correct = guess === state.current.isInCast;
  window.Analytics.track('game_answer', {
    category: state.mediaType,
    result: correct ? 'correct' : 'incorrect',
    answer: guess ? 'yes' : 'no',
    input_method: source,
    streak_before: state.streak
  });
  animateCardOut(direction);

  if (correct) {
    state.streak += 1;
    const confirmation = state.current.isInCast
      ? `${state.current.actor.name} played ${state.current.character || 'a credited role'} in ${getMediaTitle(state.current.movie)}.`
      : `${state.current.actor.name} did not appear in ${getMediaTitle(state.current.movie)}.`;
    showCorrectResult(confirmation);
  } else {
    state.streak = 0;
    if (source === 'timeout') {
      showTimeUpResult();
    } else {
      const correction = state.current.isInCast
        ? `${state.current.actor.name} played ${state.current.character || 'a credited role'} in ${getMediaTitle(state.current.movie)}.`
        : `${state.current.actor.name} did not appear in ${getMediaTitle(state.current.movie)}.`;
      showWrongResult(correction);
    }
  }
  updateProgress();

  if (state.streak === GAME_CONFIG.targetStreak) {
    scheduleTransition(showWin, 3000);
  } else {
    scheduleTransition(nextChallenge, 3000);
  }
}

function getMediaTitle(item) {
  return item.title || item.name || 'Untitled';
}

function scheduleTransition(callback, delay) {
  clearTransition();
  state.transition = window.setTimeout(callback, delay);
}

function clearTransition() {
  if (state.transition) window.clearTimeout(state.transition);
  state.transition = null;
}

function showResult(html, type) {
  el.result.innerHTML = html;
  el.result.className = `result-flash ${type}`;
  el.result.hidden = false;
}

function showWrongResult(correction) {
  el.result.textContent = 'Not quite';
  const details = document.createElement('small');
  details.textContent = `${correction} Your streak starts again.`;
  el.result.appendChild(details);
  el.result.className = 'result-flash wrong';
  el.result.hidden = false;
}

function showTimeUpResult() {
  el.result.textContent = 'Time Up';
  el.result.className = 'result-flash wrong';
  el.result.hidden = false;
}

function showCorrectResult(confirmation) {
  el.result.textContent = '✓ Correct';
  const details = document.createElement('small');
  details.textContent = confirmation;
  el.result.appendChild(details);
  el.result.className = 'result-flash correct';
  el.result.hidden = false;
}

function updateProgress() {
  const percentage = state.streak / GAME_CONFIG.targetStreak * 100;
  el.streak.textContent = state.streak;
  el.progress.style.width = `${percentage}%`;
  el.progressTrack.setAttribute('aria-valuenow', state.streak);
  el.streakMessage.textContent = state.streak === 0 ? 'Start your casting run' : state.streak < 10 ? 'Nice eye — keep going' : state.streak < 18 ? 'The 20 Club is in sight' : state.streak < GAME_CONFIG.targetStreak ? 'Almost legendary' : 'You made it';
}

function resetCard() {
  state.dragX = 0;
  el.actorCard.classList.remove('dragging');
  el.actorCard.style.transform = '';
  el.noStamp.style.opacity = 0;
  el.yesStamp.style.opacity = 0;
}

function animateCardOut(direction) {
  el.actorCard.style.transition = 'transform .36s cubic-bezier(.3,.7,.2,1)';
  el.actorCard.style.transform = `translateX(${direction * 140}%) rotate(${direction * 16}deg)`;
}

function toggleAnswers(enabled) {
  el.no.disabled = !enabled;
  el.yes.disabled = !enabled;
}

function startCountdown() {
  stopCountdown();
  state.timeLeft = 3;
  renderCountdown();
  state.countdown = window.setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      stopCountdown();
      answer(!state.current.isInCast, state.current.isInCast ? -1 : 1, 'timeout');
      return;
    }
    renderCountdown();
  }, 1000);
}

function stopCountdown() {
  if (state.countdown) window.clearInterval(state.countdown);
  state.countdown = null;
}

function renderCountdown() {
  el.cardTimer.textContent = state.timeLeft;
  el.cardTimer.setAttribute('aria-label', `${state.timeLeft} second${state.timeLeft === 1 ? '' : 's'} remaining`);
  el.cardTimer.classList.remove('tick');
  window.requestAnimationFrame(() => el.cardTimer.classList.add('tick'));
}

function onPointerDown(event) {
  if (state.busy) return;
  state.dragStart = event.clientX;
  state.dragX = 0;
  el.actorCard.classList.add('dragging');
  el.actorCard.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!el.actorCard.classList.contains('dragging')) return;
  state.dragX = event.clientX - state.dragStart;
  const rotation = Math.max(-14, Math.min(14, state.dragX / 18));
  el.actorCard.style.transform = `translateX(${state.dragX}px) rotate(${rotation}deg)`;
  el.yesStamp.style.opacity = Math.max(0, Math.min(1, state.dragX / GAME_CONFIG.swipeThreshold));
  el.noStamp.style.opacity = Math.max(0, Math.min(1, -state.dragX / GAME_CONFIG.swipeThreshold));
}

function onPointerUp() {
  if (!el.actorCard.classList.contains('dragging')) return;
  el.actorCard.classList.remove('dragging');
  if (Math.abs(state.dragX) >= GAME_CONFIG.swipeThreshold) answer(state.dragX > 0, state.dragX > 0 ? 1 : -1, 'swipe');
  else resetCard();
}

function showFatal(error) {
  console.error(error);
  state.busy = true;
  $('error-message').textContent = 'We couldn’t reach the movie database. Check your connection and try again.';
  $('error-modal').showModal();
}

function showWin() {
  el.result.hidden = true;
  $('winner-form').reset();
  $('winner-form-message').textContent = '';
  $('win-modal').showModal();
  $('winner-name').focus();
}

async function openLeaderboard() {
  const modal = $('leaderboard-modal');
  const list = $('leaderboard-list');
  const status = $('leaderboard-state');
  list.innerHTML = '';
  status.hidden = false;
  status.textContent = 'Loading winners…';
  modal.showModal();
  try {
    const winners = await window.Winners.list();
    status.hidden = winners.length > 0;
    status.textContent = 'No winners yet. The first seat is waiting.';
    winners.forEach((winner, index) => {
      const item = document.createElement('li');
      const date = new Date(winner.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      item.innerHTML = `<span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="winner-name"></span><time class="winner-date">${date}</time>`;
      item.querySelector('.winner-name').textContent = winner.username;
      list.appendChild(item);
    });
  } catch (error) {
    status.hidden = false;
    status.textContent = 'The winners table is taking a break. Please try again.';
  }
}

async function saveWinner(event) {
  event.preventDefault();
  const name = $('winner-name').value.trim();
  const button = $('save-winner');
  const message = $('winner-form-message');
  if (name.length < 2) return;
  button.disabled = true;
  message.textContent = 'Saving your place…';
  try {
    await window.Winners.save(name);
    window.Analytics.track('winner_saved', { category: state.mediaType, winning_streak: GAME_CONFIG.targetStreak });
    $('win-modal').close();
    resetGame();
    openLeaderboard();
  } catch (error) {
    message.textContent = 'Could not save your username. Please try again.';
    button.disabled = false;
  }
}

function resetGame() {
  state.streak = 0;
  updateProgress();
  nextChallenge();
}

async function switchMediaType(mediaType) {
  if (mediaType === state.mediaType || state.busy && !state.current) return;
  state.generation += 1;
  const generation = state.generation;
  clearTransition();
  stopCountdown();
  state.mediaType = mediaType;
  window.Analytics.track('category_change', { category: mediaType });
  state.movies = [];
  state.queue = [];
  state.current = null;
  state.streak = 0;
  state.busy = true;
  updateProgress();
  toggleAnswers(false);
  el.actorCard.hidden = true;
  el.result.hidden = true;
  el.placeholder.hidden = false;
  el.title.textContent = mediaType === 'movie' ? 'Loading movies…' : 'Loading TV shows…';
  el.year.textContent = 'One face. One decision.';
  el.moviesTab.classList.toggle('active', mediaType === 'movie');
  el.tvTab.classList.toggle('active', mediaType === 'tv');
  el.moviesTab.setAttribute('aria-pressed', String(mediaType === 'movie'));
  el.tvTab.setAttribute('aria-pressed', String(mediaType === 'tv'));
  el.moviesTab.disabled = true;
  el.tvTab.disabled = true;

  try {
    await loadPools();
    if (generation !== state.generation) return;
    await nextChallenge();
  } catch (error) {
    showFatal(error);
  } finally {
    el.moviesTab.disabled = false;
    el.tvTab.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  Object.assign(el, {
    title: $('movie-title'), year: $('movie-year'), actorCard: $('actor-card'), placeholder: $('card-placeholder'),
    photo: $('actor-photo'), actorName: $('actor-name'), no: $('answer-no'), yes: $('answer-yes'), result: $('result-flash'),
    streak: $('streak-count'), progress: $('progress-fill'), progressTrack: document.querySelector('.progress-track'),
    streakMessage: $('streak-message'), noStamp: document.querySelector('.swipe-no'), yesStamp: document.querySelector('.swipe-yes'),
    cardTimer: $('card-timer'), moviesTab: $('movies-tab'), tvTab: $('tv-tab')
  });

  el.no.addEventListener('click', () => answer(false, -1, 'button'));
  el.yes.addEventListener('click', () => answer(true, 1, 'button'));
  el.actorCard.addEventListener('pointerdown', onPointerDown);
  el.actorCard.addEventListener('pointermove', onPointerMove);
  el.actorCard.addEventListener('pointerup', onPointerUp);
  el.actorCard.addEventListener('pointercancel', onPointerUp);
  el.moviesTab.addEventListener('click', () => switchMediaType('movie'));
  el.tvTab.addEventListener('click', () => switchMediaType('tv'));
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') answer(false, -1, 'keyboard');
    if (event.key === 'ArrowRight') answer(true, 1, 'keyboard');
  });
  $('open-leaderboard').addEventListener('click', openLeaderboard);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('winner-form').addEventListener('submit', saveWinner);
  $('play-again').addEventListener('click', () => { $('win-modal').close(); resetGame(); });
  $('retry-game').addEventListener('click', async () => { $('error-modal').close(); await loadPools(); nextChallenge(); });

  try {
    await loadPools();
    await nextChallenge();
  } catch (error) {
    showFatal(error);
  }
});
