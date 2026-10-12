// Category filter on the index page.
(() => {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const cards = [...grid.children];
  const empty = document.getElementById("empty");
  const chips = [...document.querySelectorAll(".chip")];
  let category = "";

  const apply = () => {
    let shown = 0;
    for (const card of cards) {
      const cats = card.dataset.categories.split("|");
      const ok = !category || cats.includes(category);
      card.hidden = !ok;
      if (ok) shown++;
    }
    if (empty) empty.hidden = shown > 0;
  };

  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      category = chip.dataset.filter;
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      apply();
    })
  );
})();

// Copy-link buttons on game pages.
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied!";
    } catch {
      window.prompt("Copy this link:", btn.dataset.copy);
    }
    setTimeout(() => (btn.textContent = label), 1500);
  });
});

// Click-to-load game embeds.
document.querySelectorAll(".embed").forEach((box) => {
  box.querySelector("button")?.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = box.dataset.src;
    frame.allow = "fullscreen; autoplay; gamepad; gyroscope; accelerometer";
    frame.allowFullscreen = true;
    box.replaceChildren(frame);
  });
});

// Contact popover: shows the email with Copy / Open mail app.
document.querySelectorAll(".contact").forEach((box) => {
  const toggle = box.querySelector("[aria-expanded]");
  const pop = box.querySelector(".contact-pop");
  const setOpen = (open) => {
    pop.hidden = !open;
    toggle.setAttribute("aria-expanded", open);
  };
  toggle.addEventListener("click", () => setOpen(pop.hidden));
  document.addEventListener("click", (e) => !box.contains(e.target) && setOpen(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
});
