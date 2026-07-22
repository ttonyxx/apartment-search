const days = [
  {
    day: "Saturday", date: "October 17", name: "London → Fontainebleau", type: "Arrival",
    events: [
      ["05:00", "Arrive at <strong>London St Pancras</strong> for border control."],
      ["06:31", "Eurostar departs London; breakfast on the train."],
      ["09:57", "Arrive at <strong>Paris Gare du Nord</strong>, collect the rental car, and drive south."],
      ["14:00", "Check in, collect two large pads in Arbonne, buy groceries, and settle in."],
      ["17:00", "A garden walk and early dinner. No tired, first-day bouldering."],
    ],
    aside: "Reserve a car large enough for two folded pads and luggage, with a one-way CDG return on October 24."
  },
  {
    day: "Sunday", date: "October 18", name: "Katherine’s birthday · Éléphant", type: "Birthday", birthday: true, open: true,
    events: [
      ["08:00", "Build a birthday picnic at the <strong>Fontainebleau market</strong>."],
      ["10:15", "A joyful first session at <strong>Éléphant</strong>: circuits, slabs, mantles, no pressure."],
      ["15:30", "Leave with skin in reserve; nap, shower, and dress up."],
      ["19:15", "Birthday dinner at <strong>L’Axel</strong>, Michelin-starred French cooking with a Japanese point of view."],
    ],
    aside: "Rain version: market, Château de Fontainebleau, spa, and L’Axel. The birthday stays special even if the rock is wet."
  },
  {
    day: "Monday", date: "October 19", name: "Bas Cuvier classics", type: "Project day",
    events: [
      ["08:00", "Leave early with breakfast and lunch to get ahead of the crowds."],
      ["08:30", "Warm up on the circuits. Start two grades below the gym ego."],
      ["09:15", "Choose a lane: easy mileage, classics, or one serious project."],
      ["15:30", "Hard stop. Food, finger care, and a genuinely easy evening."],
    ],
    aside: "Add Cuvier Est only if both skin and energy are good. Duroxomanie and Goriak can wait for the right day."
  },
  {
    day: "Tuesday", date: "October 20", name: "Moret, market & recovery", type: "Rest",
    events: [
      ["Morning", "Sleep in, then browse the Tuesday market or wander <strong>Moret-sur-Loing</strong>."],
      ["Lunch", "Sit down, eat slowly, and leave the climbing shoes in the car."],
      ["15:30", "Couples recovery treatment and spa time at <strong>Hôtel Napoléon</strong>."],
      ["Evening", "Quiet dinner and early sleep. The château is closed on Tuesdays."],
    ],
    aside: "Karma is the rain reserve—not the default rest-day plan. Use it only if weather has already erased outdoor sessions."
  },
  {
    day: "Wednesday", date: "October 21", name: "Franchard Isatis + Cuisinière", type: "Project day",
    events: [
      ["08:30", "Leave for Franchard with lunch and plenty of water."],
      ["09:00", "Warm up on the Isatis blue and red circuit problems."],
      ["10:00", "Move through classics at Isatis; visit Cuisinière for Beatle Juice if that is the goal."],
      ["15:30", "Stop before tomorrow’s birthday session becomes a recovery session."],
    ],
    aside: "The sweet spot: L’Angle du Sérac, Composition des Forces, L’Envie des Bêtes, and one harder dream line."
  },
  {
    day: "Thursday", date: "October 22", name: "Tony’s birthday · Trois Pignons", type: "Birthday", birthday: true,
    events: [
      ["09:15", "Circuit warmups at <strong>La Roche aux Sabots</strong>."],
      ["12:30", "Birthday picnic before the walk through the deep sand."],
      ["13:15", "Cul de Chien and the famous roof—with enough pads and competent spotting."],
      ["19:00", "Cocktails, charcoal-grilled plates, and a candle at <strong>Le Magnum</strong>."],
    ],
    aside: "If the roof is wet or the landing is under-padded, the sand sea is still a brilliant destination. No birthday send is owed."
  },
  {
    day: "Friday", date: "October 23", name: "Château + Barbizon", type: "Rest",
    events: [
      ["08:00", "Optional Friday market breakfast and picnic shopping."],
      ["09:30", "Two unhurried hours inside the <strong>Château de Fontainebleau</strong>."],
      ["12:30", "Lunch in town."],
      ["14:00", "Barbizon village and the Barbizon School museum; pack most luggage after dinner."],
    ],
    aside: "This is also the best movable recovery day. If earlier rain cleared and the rock is fully dry, swap the château with a climbing session."
  },
  {
    day: "Saturday", date: "October 24", name: "Victory lap → CDG", type: "Travel",
    events: [
      ["08:00", "Choose the closest dry sector for easy mileage or favorite unfinished moves."],
      ["11:30", "Stop before fatigue invites a poor decision. Eat and return the pads."],
      ["14:00", "Depart for CDG with a generous traffic buffer."],
      ["Evening", "Return the car, eat near the terminal, and sleep at an airport hotel."],
    ],
    aside: "No late project attempts. If it rains, skip climbing entirely and enjoy an unhurried airport transition."
  },
  {
    day: "Sunday", date: "October 25", name: "Paris → New York", type: "Departure",
    events: [
      ["03 → 02", "France’s clocks go back overnight. Let the phone update and use a hotel wake-up call too."],
      ["Morning", "Follow the airline’s international check-in guidance for the exact terminal."],
      ["Flight", "Climbing shoes in hand luggage; pads stay in France."],
    ],
    aside: "This itinerary assumes CDG. If the ticket says Orly, return the car and sleep there instead."
  }
];

const routes = [
  { name: "Pogo", grade: "V0", font: "4", area: "Éléphant", group: "elephant", lane: "circuit", stars: 3.0, votes: 1, url: "https://www.mountainproject.com/route/122677142/pogo" },
  { name: "La Dalle à Poly", grade: "V2", font: "5+", area: "Éléphant", group: "elephant", lane: "circuit", stars: 4.0, votes: 15, url: "https://www.mountainproject.com/route/114543775/la-dalle-a-poly-black-n40-bis" },
  { name: "Surplomb Éléphant", grade: "V3", font: "6A", area: "Éléphant", group: "elephant", lane: "classic", stars: 3.0, votes: 2, url: "https://www.mountainproject.com/route/113316893/surplomb-elephant" },
  { name: "La Dalle Fléaux", grade: "V4", font: "6B", area: "Éléphant", group: "elephant", lane: "classic", stars: 4.0, votes: 4, url: "https://www.mountainproject.com/route/115792899/la-dalle-fleaux" },
  { name: "La Voie Michaud", grade: "V5", font: "6C", area: "Éléphant", group: "elephant", lane: "classic", stars: 3.5, votes: 17, url: "https://www.mountainproject.com/route/112053502/la-voie-michaud-noir-22" },
  { name: "La Traversée du Gruyère", grade: "V6−", font: "7A", area: "Éléphant", group: "elephant", lane: "project", stars: 4.0, votes: 4, url: "https://www.mountainproject.com/route/114543768/la-traversee-du-gruyere" },
  { name: "Terminator", grade: "V7", font: "7A+", area: "Éléphant", group: "elephant", lane: "project", stars: 3.5, votes: 2, url: "https://www.mountainproject.com/route/122346613/terminator" },
  { name: "La Marie-Rose", grade: "V3", font: "6A", area: "Bas Cuvier", group: "cuvier", lane: "circuit", stars: 4.0, votes: 26, url: "https://www.mountainproject.com/route/119450250/la-marie-rose" },
  { name: "Hier Encore", grade: "V4+", font: "6B+", area: "Bas Cuvier", group: "cuvier", lane: "classic", stars: 3.5, votes: 6, url: "https://www.mountainproject.com/route/122946469/hier-encore" },
  { name: "Le Participe Présent", grade: "V5", font: "6C", area: "Bas Cuvier", group: "cuvier", lane: "classic", stars: 3.5, votes: 5, url: "https://www.mountainproject.com/route/122197168/le-participe-present" },
  { name: "Hélicoptère", grade: "V6", font: "7A", area: "Bas Cuvier", group: "cuvier", lane: "classic", stars: 3.5, votes: 13, url: "https://www.mountainproject.com/route/114271940/helicoptere" },
  { name: "Charcuterie", grade: "V6+", font: "7A", area: "Bas Cuvier", group: "cuvier", lane: "project", stars: 4.0, votes: 3, url: "https://www.mountainproject.com/route/117640832/charcuterie" },
  { name: "Goriak", grade: "V8", font: "7B", area: "Cuvier Est", group: "cuvier", lane: "project", stars: 3.0, votes: 6, url: "https://www.mountainproject.com/route/123255876/goriak" },
  { name: "Contrôle Technique", grade: "V10", font: "7C+", area: "Bas Cuvier", group: "cuvier", lane: "project", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/122952704/controle-technique" },
  { name: "Red 18", grade: "V2", font: "5+", area: "Franchard Isatis", group: "franchard", lane: "circuit", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/113317267/red-18" },
  { name: "Le Crocodil", grade: "V3", font: "6A", area: "Franchard Isatis", group: "franchard", lane: "circuit", stars: 3.5, votes: 9, url: "https://www.mountainproject.com/route/122964563/le-crocodil" },
  { name: "L’Angle du Sérac", grade: "V4+", font: "6B+", area: "Franchard Isatis", group: "franchard", lane: "classic", stars: 4.0, votes: 10, url: "https://www.mountainproject.com/route/114527214/langle-du-serac" },
  { name: "Composition des Forces", grade: "V5", font: "6C", area: "Franchard Isatis", group: "franchard", lane: "classic", stars: 3.5, votes: 4, url: "https://www.mountainproject.com/route/113581152/composition-des-forces" },
  { name: "L’Envie des Bêtes", grade: "V6", font: "7A", area: "Franchard Isatis", group: "franchard", lane: "classic", stars: 3.5, votes: 3, url: "https://www.mountainproject.com/route/114527204/lenvie-des-betes-assis" },
  { name: "Beatle Juice", grade: "V7", font: "7A+", area: "Franchard Cuisinière", group: "franchard", lane: "project", stars: 4.0, votes: 7, url: "https://www.mountainproject.com/route/113316770/beatle-juice" },
  { name: "Froggy D", grade: "V8", font: "7B", area: "Franchard Isatis", group: "franchard", lane: "project", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/122964472/froggy-d" },
  { name: "Blue Circuit", grade: "V2–3", font: "5+", area: "Roche aux Sabots", group: "sabots", lane: "circuit", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/122052175/blue-circuit" },
  { name: "Le Surplomb à Coulisse", grade: "V3+", font: "6A+", area: "Roche aux Sabots", group: "sabots", lane: "classic", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/114564269/red-3-le-surplomb-a-coulisse" },
  { name: "Le Mur à Michaud", grade: "V4", font: "6B", area: "Roche aux Sabots", group: "sabots", lane: "classic", stars: 4.0, votes: 1, url: "https://www.mountainproject.com/route/114564239/red-29-le-mur-a-michaud" },
  { name: "Jeux de Toit", grade: "V6+", font: "7A", area: "Roche aux Sabots", group: "sabots", lane: "project", stars: 4.0, votes: 4, url: "https://www.mountainproject.com/route/113316930/jeux-de-toit" },
  { name: "L’Oblique", grade: "V6–7", font: "7A+", area: "Roche aux Sabots", group: "sabots", lane: "project", stars: 3.5, votes: 9, url: "https://www.mountainproject.com/route/113316948/loblique" },
  { name: "Le Toit du Cul de Chien", grade: "V6", font: "7A", area: "Cul de Chien", group: "sabots", lane: "project", stars: 4.0, votes: 10, url: "https://www.mountainproject.com/route/123870127/le-toit-du-cul-de-chien" }
];

const bookings = [
  ["flight", "Confirm the flight", "Airport, terminal, and exact departure time for October 25.", "Critical"],
  ["car", "Reserve the car", "Gare du Nord pickup; CDG return; room for two pads and luggage.", "Transport"],
  ["hotel", "Book the airport night", "October 24 near the correct CDG terminal—or Orly if the ticket says so.", "Critical"],
  ["pads", "Reserve two crash pads", "October 17–24; add a third for high or complex landings.", "Climbing"],
  ["laxel", "Reserve L’Axel", "Sunday, October 18 at 7:15 PM; mention Katherine’s birthday.", "Birthday"],
  ["magnum", "Reserve Le Magnum", "Thursday, October 22 around 7:00 PM; mention Tony’s birthday.", "Birthday"],
  ["spa", "Book the recovery spa", "Hôtel & Spa Napoléon on Tuesday afternoon.", "Recovery"],
  ["chateau", "Book château tickets", "Friday morning, movable to a rainy Sunday or Thursday.", "Culture"],
  ["maps", "Download offline maps", "Boolder, Bleau.info, and the Mountain Project shortlist.", "Climbing"]
];

const timeline = document.querySelector("#timeline");

function renderTimeline() {
  timeline.innerHTML = days.map((day, index) => `
    <article class="day-row reveal${day.open ? " open" : ""}">
      <button class="day-summary" type="button" aria-expanded="${day.open ? "true" : "false"}" aria-controls="day-${index}">
        <span class="day-num">0${index + 1}</span>
        <span class="day-date">${day.day}<strong>${day.date}</strong></span>
        <span class="day-name">${day.name}</span>
        <span class="day-type${day.birthday ? " birthday" : ""}">${day.type}</span>
        <span class="day-plus" aria-hidden="true">+</span>
      </button>
      <div class="day-detail" id="day-${index}">
        <div class="day-detail-inner">
          <div class="day-events">
            ${day.events.map(([time, copy]) => `<div class="day-event"><time>${time}</time><p>${copy}</p></div>`).join("")}
          </div>
          <aside class="day-aside"><small>Keep in mind</small><p>${day.aside}</p></aside>
        </div>
      </div>
    </article>
  `).join("");

  timeline.querySelectorAll(".day-row").forEach((row) => {
    const button = row.querySelector(".day-summary");
    const detail = row.querySelector(".day-detail");
    if (row.classList.contains("open")) detail.style.maxHeight = `${detail.scrollHeight}px`;
    button.addEventListener("click", () => {
      const isOpen = row.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
      detail.style.maxHeight = isOpen ? `${detail.scrollHeight}px` : "0px";
    });
  });
}

let activeArea = "all";
let activeLane = "all";

function laneLabel(lane) {
  return { circuit: "Circuit", classic: "Classic", project: "Project" }[lane];
}

function renderRoutes() {
  const visible = routes.filter((route) =>
    (activeArea === "all" || route.group === activeArea) &&
    (activeLane === "all" || route.lane === activeLane)
  );
  document.querySelector("#routeCount").textContent = `${visible.length} problem${visible.length === 1 ? "" : "s"}`;
  document.querySelector("#routeGrid").innerHTML = visible.length ? visible.map((route) => `
    <article class="route-card">
      <div class="route-top">
        <div>
          <p class="route-area">${route.area}</p>
          <h3><a href="${route.url}" target="_blank" rel="noreferrer">${route.name}</a></h3>
        </div>
        <div class="route-grade"><strong>${route.grade}</strong><span>${route.font} Font</span></div>
      </div>
      <span class="route-arrow" aria-hidden="true">↗</span>
      <div class="route-bottom">
        <span class="route-lane">${laneLabel(route.lane)}</span>
        <span class="route-stats">${route.stars.toFixed(1)} ★ · ${route.votes} vote${route.votes === 1 ? "" : "s"}</span>
      </div>
    </article>
  `).join("") : `<div class="empty-state"><h3>No lines in this combination.</h3><p>Try another sector or lane.</p></div>`;
}

document.querySelectorAll("#areaFilters .filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#areaFilters .filter").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    activeArea = button.dataset.area;
    renderRoutes();
  });
});

document.querySelector("#laneFilter").addEventListener("change", (event) => {
  activeLane = event.target.value;
  renderRoutes();
});

function renderBookings() {
  const checklist = document.querySelector("#bookingChecklist");
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("font-trip-bookings") || "{}"); } catch (_) { saved = {}; }
  checklist.innerHTML = bookings.map(([id, title, detail, tag]) => `
    <div class="check-item">
      <label for="booking-${id}">
        <input id="booking-${id}" type="checkbox" data-booking="${id}" ${saved[id] ? "checked" : ""}>
        <span class="custom-check" aria-hidden="true"></span>
        <span class="check-copy"><strong>${title}</strong><small>${detail}</small></span>
        <span class="check-tag">${tag}</span>
      </label>
    </div>
  `).join("");
  document.querySelector("#bookingTotal").textContent = bookings.length;
  checklist.querySelectorAll("input").forEach((input) => input.addEventListener("change", updateBookings));
  updateBookings();
}

function updateBookings() {
  const inputs = [...document.querySelectorAll("[data-booking]")];
  const state = Object.fromEntries(inputs.map((input) => [input.dataset.booking, input.checked]));
  try { localStorage.setItem("font-trip-bookings", JSON.stringify(state)); } catch (_) { /* storage can be unavailable */ }
  const done = inputs.filter((input) => input.checked).length;
  document.querySelector("#bookingDone").textContent = done;
  document.querySelector("#bookingProgress").style.width = `${(done / inputs.length) * 100}%`;
}

function updateCountdown() {
  const trip = new Date("2026-10-17T05:00:00+01:00");
  const now = new Date();
  const diff = trip - now;
  const output = document.querySelector("#countdown");
  if (diff <= 0) {
    output.textContent = now < new Date("2026-10-26T00:00:00+01:00") ? "You’re in the forest" : "Until next time";
    return;
  }
  const daysLeft = Math.floor(diff / 86400000);
  const hoursLeft = Math.floor((diff % 86400000) / 3600000);
  output.textContent = `${daysLeft} days · ${hoursLeft} hours`;
}

const header = document.querySelector("#siteHeader");
const progress = document.querySelector("#scrollProgress");

function onScroll() {
  header.classList.toggle("scrolled", window.scrollY > 36);
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0}%`;
}

const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  mobileMenu.hidden = true;
  document.body.classList.remove("menu-open");
}

menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  mobileMenu.hidden = open;
  document.body.classList.toggle("menu-open", !open);
});

mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });

renderTimeline();
renderRoutes();
renderBookings();
updateCountdown();
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  document.querySelectorAll(".day-row.open .day-detail").forEach((detail) => { detail.style.maxHeight = `${detail.scrollHeight}px`; });
  if (window.innerWidth > 980) closeMenu();
});
onScroll();
