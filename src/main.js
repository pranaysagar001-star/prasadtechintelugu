import "./styles.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Editable data structure for Must Watch YouTube videos.
 * Supports updating, reordering, or adding new items with 'id' or 'url'.
 */
export const mustWatchVideos = [
  {
    id: "RCFBtYVi8SE",
    url: "https://youtu.be/RCFBtYVi8SE",
    title: "Tech News 2000 || Prasad Tech in Telugu ||",
    thumbnail: "https://i.ytimg.com/vi/RCFBtYVi8SE/maxresdefault.jpg",
  },
  {
    id: "7MjeH-hE9yw",
    url: "https://youtu.be/7MjeH-hE9yw",
    title: "Middle Class వాళ్లు చేసే Biggest Money Mistakes! || Vodcast With Prasad Episode 2",
    thumbnail: "https://i.ytimg.com/vi/7MjeH-hE9yw/maxresdefault.jpg",
  },
  {
    id: "TBlm6wcij94",
    url: "https://youtu.be/TBlm6wcij94",
    title: "Paradise Fitness Coach | Stop Doing These Health Mistakes ! Vodcast with Prasad Ep 5 #paradise",
    thumbnail: "https://i.ytimg.com/vi/TBlm6wcij94/maxresdefault.jpg",
  },
  {
    id: "Okfcf9gpqhY",
    url: "https://youtu.be/Okfcf9gpqhY",
    title: "మొదటిసారి నటించాను.. Prasad X Dulquer - Tech Therapy || PrasadLifestyle",
    thumbnail: "https://i.ytimg.com/vi/Okfcf9gpqhY/maxresdefault.jpg",
  },
  {
    id: "JIbgAvu8edY",
    url: "https://youtu.be/JIbgAvu8edY",
    title: "Tech News 2122 || Samsung S26 Series, POCO X8 Series,vivo 12000mAh Battery,TecnoConcept Phone, Etc.",
    thumbnail: "https://i.ytimg.com/vi/JIbgAvu8edY/maxresdefault.jpg",
  },
];

/**
 * Extracts a 11-character YouTube video ID from a URL or raw ID string.
 */
export function getYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  const match = String(urlOrId).match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : String(urlOrId).trim();
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scrollProgress(element, startOffset = 0, endOffset = 1) {
  const rect = element.getBoundingClientRect();
  const total = element.offsetHeight - window.innerHeight;
  const raw = -rect.top / Math.max(1, total);
  return clamp((raw - startOffset) / (endOffset - startOffset));
}

/**
 * True bidirectional scroll-driven video scrubbing engine.
 * - Entire video timeline completes before Diversification section takes over.
 * - Bidirectional scrubbing: scrolls forward on down, smoothly rewinds on up.
 * - Never autoplays independently of scroll position.
 * - Never resets to frame 1 on scroll down or direction reversal.
 * - Responsive, lag-free frame seeking with rAF scheduling and adaptive smoothing.
 */
function initHeroScrub() {
  const section = document.querySelector("#scrubHero");
  const video = document.querySelector("#heroVideo");
  if (!section || !video) return;

  // Ensure video is strictly paused and purely driven by scroll
  video.pause();
  video.loop = false;
  video.autoplay = false;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.controls = false;
  video.removeAttribute("loop");
  video.removeAttribute("autoplay");
  video.removeAttribute("controls");

  // Prevent any spontaneous browser playback
  video.addEventListener("play", () => {
    if (!video.paused) {
      video.pause();
    }
  });

  let duration = video.duration || 0;
  let targetProgress = 0;
  let smoothedProgress = 0;
  let isSeeking = false;
  let seekStartTime = 0;
  let pendingSeekTime = null;
  let rafId = 0;

  // Dedicated scroll distance (7 screens of scroll distance = 800vh total section height)
  const HERO_SCROLL_SCREENS = 7;
  // Progress fraction where the video timeline completes 100% of its frames.
  // The hold zone (0.86 to 1.0) guarantees the video finishes completely before Diversification enters.
  const VIDEO_END_RATIO = 0.86;

  const applyScrollLength = () => {
    if (reducedMotion) return;
    section.style.setProperty("--hero-scroll-height", `${(1 + HERO_SCROLL_SCREENS) * 100}vh`);
  };

  const getHeroScrollProgress = () => {
    const rect = section.getBoundingClientRect();
    const totalScroll = Math.max(1, section.offsetHeight - window.innerHeight);
    return clamp(-rect.top / totalScroll, 0, 1);
  };

  const getMaxVideoTime = () => {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    // Keep 1/60th second before true end to avoid browser "ended" event edge cases
    return Math.max(0, duration - (1 / 60));
  };

  const updateTargetFromScroll = () => {
    const rawProgress = getHeroScrollProgress();
    // Maps raw scroll progress to video progress: 0.0 -> 0.0, VIDEO_END_RATIO -> 1.0
    const videoProgress = clamp(rawProgress / VIDEO_END_RATIO, 0, 1);
    targetProgress = videoProgress;
    section.style.setProperty("--hero-progress", videoProgress.toFixed(4));
  };

  const syncDuration = () => {
    const next = video.duration;
    if (Number.isFinite(next) && next > 0 && next !== Number.POSITIVE_INFINITY) {
      duration = next;
      applyScrollLength();
      updateTargetFromScroll();
    }
  };

  const performSeek = (time) => {
    if (!Number.isFinite(time)) return;
    const maxT = getMaxVideoTime();
    const clampedTime = clamp(time, 0, maxT);

    // If currently waiting for decoder, queue the latest timestamp
    if (isSeeking || video.seeking) {
      pendingSeekTime = clampedTime;
      return;
    }

    if (Math.abs(video.currentTime - clampedTime) > 0.008) {
      isSeeking = true;
      seekStartTime = performance.now();
      try {
        video.currentTime = clampedTime;
      } catch {
        isSeeking = false;
      }
    }
  };

  const poster = document.querySelector("#heroPoster");
  let isPosterHidden = false;

  const revealVideo = () => {
    if (isPosterHidden || !poster) return;
    isPosterHidden = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        poster.classList.add("is-hidden");
      });
    });
  };

  video.addEventListener("seeked", () => {
    isSeeking = false;
    revealVideo();
    if (pendingSeekTime !== null) {
      const next = pendingSeekTime;
      pendingSeekTime = null;
      if (Math.abs(video.currentTime - next) > 0.008) {
        performSeek(next);
      }
    }
  });

  video.addEventListener("loadedmetadata", syncDuration);
  video.addEventListener("durationchange", syncDuration);
  video.addEventListener("loadeddata", () => {
    syncDuration();
    updateTargetFromScroll();
    smoothedProgress = targetProgress;
    performSeek(smoothedProgress * getMaxVideoTime());
    revealVideo();
  });

  video.addEventListener("waiting", () => section.classList.add("is-buffering"));
  video.addEventListener("canplay", () => {
    section.classList.remove("is-buffering");
    revealVideo();
  });
  video.addEventListener("canplaythrough", () => {
    section.classList.remove("is-buffering");
    revealVideo();
  });

  // Main animation frame loop for smooth, responsive seeking
  const renderLoop = () => {
    updateTargetFromScroll();

    // Safety watchdog: reset seek lock if decoder took abnormally long (>120ms)
    if (isSeeking && performance.now() - seekStartTime > 120) {
      isSeeking = false;
    }

    if (duration > 0 && video.readyState >= 1) {
      const diff = targetProgress - smoothedProgress;
      const absDiff = Math.abs(diff);

      if (absDiff < 0.001) {
        smoothedProgress = targetProgress;
      } else {
        // Dynamic adaptive smoothing:
        // On large shifts / rapid direction changes: aggressive catch-up (0.82) to prevent drift
        // On micro-scrolls: smooth damping (0.45) to eliminate wheel stepped jitter
        const factor = absDiff > 0.12 ? 0.82 : 0.45;
        smoothedProgress += diff * factor;
      }

      const targetTime = smoothedProgress * getMaxVideoTime();
      performSeek(targetTime);
    }

    rafId = requestAnimationFrame(renderLoop);
  };

  window.addEventListener("scroll", updateTargetFromScroll, { passive: true });
  window.addEventListener("resize", () => {
    applyScrollLength();
    updateTargetFromScroll();
  });

  applyScrollLength();
  updateTargetFromScroll();
  smoothedProgress = targetProgress;

  if (video.readyState >= 1) {
    syncDuration();
  }
  if (video.readyState >= 2) {
    revealVideo();
  }

  if (!reducedMotion) {
    rafId = requestAnimationFrame(renderLoop);
  }

  window.addEventListener("pagehide", () => cancelAnimationFrame(rafId));
}

function initEcosystemReveal() {
  const section = document.querySelector("#ecosystemFilm");
  if (!section) return;

  // Reveal thresholds matching each identity's visual entrance:
  // 1. Prasad Tech in Telugu (central origin logo): visible immediately once section begins (>= 0.02)
  // 2. Prasad Automobile: opacity starts rising at progress >= 0.26
  // 3. Prasad Tech Shorts: opacity starts rising at progress >= 0.42
  // 4. Prasad The Gamer: opacity starts rising at progress >= 0.58
  // 5. Prasad Lifestyle: opacity starts rising at progress >= 0.64
  const identities = [
    { element: section.querySelector(".origin-logo"), threshold: 0.02 },
    { element: section.querySelector(".identity--auto"), threshold: 0.26 },
    { element: section.querySelector(".identity--shorts"), threshold: 0.42 },
    { element: section.querySelector(".identity--gaming"), threshold: 0.58 },
    { element: section.querySelector(".identity--lifestyle"), threshold: 0.64 },
  ];

  const update = () => {
    const progress = scrollProgress(section, 0.06, 0.94);
    section.style.setProperty("--ecosystem-progress", progress.toFixed(4));

    // Make each individual identity an active clickable button immediately upon reveal
    for (const item of identities) {
      if (!item.element) continue;
      const isVisible = reducedMotion || progress >= item.threshold;
      item.element.classList.toggle("is-revealed", isVisible);
    }
  };

  window.addEventListener("scroll", () => window.requestAnimationFrame(update), { passive: true });
  window.addEventListener("resize", update);
  update();
}

/**
 * Cinematic Infinite Horizontal Video Belt
 * - Renders a continuous horizontal track with cloned sets for an unbreakable infinite loop.
 * - Center video is prominent (scale: 1), surrounding videos progressively smaller (0.85 / 0.76).
 * - Center video holds for 5.0 seconds.
 * - Transitions in 0.65 seconds via smooth GPU translate3d and concurrent scaling.
 * - Entire belt moves as one continuous physical film reel.
 * - Seamless loop wrap happens during stationary hold with zero visible jump.
 * - Hover pauses auto-advance; click opens corresponding YouTube video in new tab.
 */
function initVideoBelt() {
  const container = document.querySelector("#videoBelt");
  const viewport = document.querySelector("#videoBeltViewport");
  const track = document.querySelector("#videoBeltTrack");
  if (!container || !viewport || !track) return;

  const N = mustWatchVideos.length; // 5
  const REPEAT_COUNT = 5; // 25 cards total for seamless continuous loop
  const HOLD_DURATION = 3000; // Exactly ~3.0s hold
  const TRANSITION_DURATION = 550; // 0.55s fast, buttery smooth transition
  const START_INDEX = N * 2; // Start at index 10 (middle set)

  // Render cards into track - clean, clutter-free thumbnails as hero visual
  const allCardsData = [];
  for (let r = 0; r < REPEAT_COUNT; r++) {
    for (let i = 0; i < N; i++) {
      allCardsData.push({ ...mustWatchVideos[i], originalIndex: i });
    }
  }

  track.innerHTML = allCardsData
    .map((item, index) => {
      const title = escapeHtml(item.title);
      const thumb = item.thumbnail || `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`;
      return `
        <a
          class="video-belt__card"
          href="${item.url}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${title}"
          data-belt-index="${index}"
        >
          <div class="video-belt__frame">
            <img
              src="${thumb}"
              alt="${title}"
              loading="lazy"
              draggable="false"
            />
            <div class="video-belt__glow" aria-hidden="true"></div>
          </div>
          <div class="video-belt__meta">
            <h3 class="video-belt__title">${title}</h3>
          </div>
        </a>
      `;
    })
    .join("");

  const cards = Array.from(track.querySelectorAll(".video-belt__card"));
  let currentIndex = START_INDEX;
  let timerId = null;
  let isTransitioning = false;
  let isHovered = false;

  // 5-card visible visual hierarchy: far-left (~0.75), left (~0.85), center (1.0), right (~0.85), far-right (~0.75)
  const updateCardHierarchy = () => {
    cards.forEach((card, idx) => {
      const diff = Math.abs(idx - currentIndex);
      card.classList.remove("is-center", "is-neighbor", "is-far", "is-outer");
      if (diff === 0) {
        card.classList.add("is-center");
        card.setAttribute("aria-current", "true");
      } else if (diff === 1) {
        card.classList.add("is-neighbor");
        card.removeAttribute("aria-current");
      } else if (diff === 2) {
        card.classList.add("is-far");
        card.removeAttribute("aria-current");
      } else {
        card.classList.add("is-outer");
        card.removeAttribute("aria-current");
      }
    });
  };

  const getCenterTranslate = (index) => {
    if (!cards[index]) return 0;
    const card = cards[index];
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const vpCenter = viewport.offsetWidth / 2;
    return vpCenter - cardCenter;
  };

  const setTrackPosition = (immediate = false) => {
    if (immediate) {
      track.style.transition = "none";
    } else {
      track.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 1, 0.35, 1)`;
    }
    const x = getCenterTranslate(currentIndex);
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  };

  const advanceBelt = () => {
    if (reducedMotion || isTransitioning || isHovered) return;
    isTransitioning = true;
    currentIndex++;

    setTrackPosition(false);
    updateCardHierarchy();

    setTimeout(() => {
      isTransitioning = false;

      // Infinite loop wrap check:
      // When currentIndex reaches N * 3 (index 15), seamlessly wrap back by N (index 10)
      // during the stationary 3-second hold. Zero visible reset, gap, or jump.
      if (currentIndex >= N * 3) {
        currentIndex -= N;
        setTrackPosition(true);
        updateCardHierarchy();
        void track.offsetHeight; // force reflow
        track.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 1, 0.35, 1)`;
      }

      if (!isHovered && !reducedMotion) {
        scheduleNext();
      }
    }, TRANSITION_DURATION);
  };

  const scheduleNext = () => {
    clearTimeout(timerId);
    if (reducedMotion) return;
    timerId = setTimeout(advanceBelt, HOLD_DURATION);
  };

  // Hover interactions: pause auto-advance on mouseenter, resume on mouseleave
  container.addEventListener("mouseenter", () => {
    isHovered = true;
    clearTimeout(timerId);
  });

  container.addEventListener("mouseleave", () => {
    isHovered = false;
    if (!isTransitioning) {
      scheduleNext();
    }
  });

  // Keep center card strictly centered on viewport resize
  window.addEventListener("resize", () => {
    setTrackPosition(true);
  });

  // Initial positioning after layout calculation
  requestAnimationFrame(() => {
    setTrackPosition(true);
    updateCardHierarchy();
    void track.offsetHeight;
    if (!reducedMotion) {
      scheduleNext();
    }
  });
}

export const journeyChapters = [
  {
    year: "2016",
    title: "THE BEGINNING",
    z: 800,
    milestones: [
      {
        id: "m-2016-1",
        date: "Feb 17th, 2016",
        title: "1st Video",
        desc: "Freedom 251",
        type: "phone",
        badge: "ORIGIN",
        z: 1500,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2016-2",
        date: "Sep 28th, 2016",
        title: "1st Unboxing",
        desc: "Moto E3 Power",
        type: "unboxing",
        badge: "HARDWARE",
        z: 2300,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2016-3",
        date: "Dec 4th, 2016",
        title: "100 Videos Posted",
        desc: "The Foundation",
        type: "counter",
        badge: "CENTURY",
        z: 3100,
        x: -360,
        y: 0,
        rotY: 12,
      },
    ],
  },
  {
    year: "2017",
    title: "EARLY GROWTH",
    z: 4000,
    milestones: [
      {
        id: "m-2017-1",
        date: "Jan 15th, 2017",
        title: "Don't Do These",
        desc: "5 things in your mobile",
        type: "guide",
        badge: "VIRAL GUIDE",
        z: 4700,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2017-2",
        date: "2017",
        title: "1L Subscribers",
        desc: "Silver Milestone Achieved",
        type: "subscribers",
        badge: "100K CREATOR",
        z: 5400,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2017-3",
        date: "2017",
        title: "10 Million+ Views",
        desc: "Regional Digital Resonance",
        type: "views",
        badge: "10,000,000+",
        z: 6100,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2017-4",
        date: "May 5th, 2017",
        title: "1st TechNews",
        desc: "Telugu Tech Flagship Born",
        type: "technews",
        badge: "EPISODE 1",
        z: 6800,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2017-5",
        date: "Oct 15th, 2017",
        title: "1st Review Unit",
        desc: "Tenor E",
        type: "phone",
        badge: "BRAND ACCESS",
        z: 7500,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2017-6",
        date: "Nov 13th, 2017",
        title: "1st Launch Event",
        desc: "Attend (1st Vlog) — OnePlus 5T",
        type: "event",
        badge: "LAUNCH EVENT",
        z: 8200,
        x: -380,
        y: 0,
        rotY: 12,
      },
    ],
  },
  {
    year: "2018",
    title: "DIGITAL PRESENCE",
    z: 9100,
    milestones: [
      {
        id: "m-2018-1",
        date: "Aug 28th, 2018",
        title: "1st Instagram Post",
        desc: "Ecosystem Beyond YouTube",
        type: "social",
        badge: "COMMUNITY",
        z: 9800,
        x: 0,
        y: 0,
        rotY: 0,
      },
    ],
  },
  {
    year: "2019",
    title: "REGIONAL LANDMARK",
    z: 10700,
    milestones: [
      {
        id: "m-2019-1",
        date: "Jan 30th, 2019",
        title: "1st South Indian Regional Tech Channel",
        desc: "Crossed 100 Million Views on YouTube",
        type: "crown",
        badge: "100M REGIONAL MILESTONE",
        z: 11400,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2019-2",
        date: "2019",
        title: "PrasadTheGamer Started",
        desc: "Gaming Realm Inauguration",
        type: "gaming",
        badge: "GAMING EXPANSION",
        z: 12200,
        x: 380,
        y: 0,
        rotY: -12,
      },
    ],
  },
  {
    year: "2020",
    title: "MAJOR EXPANSION",
    z: 13100,
    milestones: [
      {
        id: "m-2020-1",
        date: "Jan 2020",
        title: "1 Million Subscribers",
        desc: "Gold Play Button Achieved",
        type: "subscribers",
        badge: "1,000,000 CREATOR",
        z: 13800,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2020-2",
        date: "Mar 12th, 2020",
        title: "Trending",
        desc: "1st Tech News",
        type: "trending",
        badge: "TRENDING #1",
        z: 14500,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2020-3",
        date: "July 21st, 2020",
        title: "1st Unboxing Video Trending on YouTube",
        desc: "OnePlus Nord Unboxing",
        type: "unboxing",
        badge: "NORD UNBOXING",
        z: 15200,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2020-4",
        date: "Sep 28th, 2020",
        title: "PrasadLifeStyle Started",
        desc: "Personal & Creative Realm",
        type: "lifestyle",
        badge: "LIFESTYLE IDENTITY",
        z: 15900,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2020-5",
        date: "Nov 2nd, 2020",
        title: "1st Review Unit from Apple",
        desc: "Cupertino Direct Recognition",
        type: "apple",
        badge: "APPLE OFFICIAL",
        z: 16600,
        x: -380,
        y: 0,
        rotY: 12,
      },
    ],
  },
  {
    year: "2021",
    title: "THE MILLENNIUM",
    z: 17500,
    milestones: [
      {
        id: "m-2021-1",
        date: "Feb 21st, 2021",
        title: "TechNews 1000",
        desc: "One Thousand Consecutive Episodes",
        type: "monolith",
        badge: "TECHNEWS 1000",
        z: 18200,
        x: 0,
        y: 0,
        rotY: 0,
      },
    ],
  },
  {
    year: "2022",
    title: "ECOSYSTEM EXPLOSION",
    z: 19100,
    milestones: [
      {
        id: "m-2022-1",
        date: "March 11th, 2022",
        title: "1st Short Uploaded on YouTube",
        desc: "Micro-format Wave Emergence",
        type: "shorts",
        badge: "YOUTUBE SHORTS",
        z: 19800,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2022-2",
        date: "April 23rd, 2022",
        title: "2 Million Subscribers",
        desc: "Community Doubled",
        type: "subscribers",
        badge: "2,000,000",
        z: 20500,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2022-3",
        date: "May 1st, 2022",
        title: "1st International Launch Event",
        desc: "vivo X80 Series",
        type: "event",
        badge: "GLOBAL EXPEDITION",
        z: 21200,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2022-4",
        date: "July 13th, 2022",
        title: "1st TechNews in India Crossed 100K Likes on YouTube",
        desc: "TN 1372",
        type: "likes",
        badge: "100K LIKES RECORD",
        z: 21900,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2022-5",
        date: "July 22nd, 2022",
        title: "3 Million Subscribers",
        desc: "Tripled Milestone",
        type: "subscribers",
        badge: "3,000,000",
        z: 22600,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2022-6",
        date: "Aug 15th, 2022",
        title: "PRASADAUTOMOBILE Started",
        desc: "Automotive World Unleashed",
        type: "auto",
        badge: "AUTOMOTIVE",
        z: 23300,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2022-7",
        date: "2022",
        title: "No. 1 Tech Channel in India",
        desc: "Source: Data Being",
        type: "crown",
        badge: "NATIONAL #1",
        z: 24000,
        x: 0,
        y: 0,
        rotY: 0,
      },
    ],
  },
  {
    year: "2023",
    title: "PRODUCTION SCALE",
    z: 24900,
    milestones: [
      {
        id: "m-2023-1",
        date: "July 5th, 2023",
        title: "1st Ad Shoot",
        desc: "DQ",
        type: "cinema",
        badge: "COMMERCIAL SET",
        z: 25600,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2023-2",
        date: "July 7th, 2023",
        title: "4 Million Subscribers",
        desc: "Four Million Strong",
        type: "subscribers",
        badge: "4,000,000",
        z: 26300,
        x: 380,
        y: 0,
        rotY: -12,
      },
    ],
  },
  {
    year: "2024",
    title: "LEGENDARY ENCOUNTERS",
    z: 27200,
    milestones: [
      {
        id: "m-2024-1",
        date: "April 1st, 2024",
        title: "Meet Legendary Actor",
        desc: "Chiranjeevi Garu",
        type: "cinema",
        badge: "LEGENDARY MEETING",
        z: 27900,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2024-2",
        date: "Nov 9th, 2024",
        title: "Instagram 1 Million Followers",
        desc: "Seven-Figure Social Reach",
        type: "social",
        badge: "1M FOLLOWERS",
        z: 28600,
        x: 380,
        y: 0,
        rotY: -12,
      },
    ],
  },
  {
    year: "2025",
    title: "THE APEX",
    z: 29500,
    milestones: [
      {
        id: "m-2025-1",
        date: "Jan 1st, 2025",
        title: "BTT Channel Started",
        desc: "Behind The Tech Channel",
        type: "broadcast",
        badge: "BTT BROADCAST",
        z: 30200,
        x: -380,
        y: 0,
        rotY: 12,
      },
      {
        id: "m-2025-2",
        date: "July 30th, 2025",
        title: "TechNews 2000",
        desc: "Two Thousand Consecutive Editions",
        type: "monolith",
        badge: "TECHNEWS 2000",
        z: 30900,
        x: 380,
        y: 0,
        rotY: -12,
      },
      {
        id: "m-2025-3",
        date: "Dec 20th, 2025",
        title: "5 Million Subscribers",
        desc: "Half a Crore Community",
        type: "subscribers",
        badge: "5,000,000",
        z: 31600,
        x: 0,
        y: 0,
        rotY: 0,
      },
    ],
  },
  {
    year: "2026",
    title: "THE DESTINATION",
    z: 32400,
    milestones: [
      {
        id: "m-2026-1",
        date: "Feb 17th, 2026",
        title: "10 YEARS",
        desc: "OF PRASAD TECH IN TELUGU",
        type: "decade",
        badge: "10 YEARS YOUTUBE JOURNEY",
        z: 33100,
        x: 0,
        y: 0,
        rotY: 0,
        isDestination: true,
      },
      {
        id: "m-2026-2",
        date: "The Horizon",
        title: "NEXT MILESTONE",
        desc: "YET TO BE REVEALED",
        type: "mystery",
        badge: "THE FUTURE",
        z: 33900,
        x: 0,
        y: 0,
        rotY: 0,
        isMystery: true,
      },
    ],
  },
];

function getMilestoneIcon(type) {
  switch (type) {
    case "phone":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <line x1="12" y1="18" x2="12.01" y2="18" stroke-width="2.5" />
      </svg>`;
    case "unboxing":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>`;
    case "counter":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="6" y1="9" x2="6" y2="15" />
        <line x1="10" y1="9" x2="10" y2="15" />
        <line x1="14" y1="9" x2="14" y2="15" />
        <line x1="18" y1="9" x2="18" y2="15" />
      </svg>`;
    case "guide":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 11 12 14 16 9" />
      </svg>`;
    case "subscribers":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
      </svg>`;
    case "views":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>`;
    case "technews":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>`;
    case "event":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>`;
    case "social":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="2.5" />
      </svg>`;
    case "crown":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="rgba(214, 179, 107, 0.2)" />
        <circle cx="12" cy="19" r="2" fill="currentColor" />
      </svg>`;
    case "gaming":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="4" />
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
        <circle cx="17" cy="13" r="1" fill="currentColor" />
      </svg>`;
    case "trending":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>`;
    case "lifestyle":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>`;
    case "apple":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v4" />
        <rect x="4" y="6" width="16" height="15" rx="3" />
        <line x1="4" y1="11" x2="20" y2="11" />
      </svg>`;
    case "monolith":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="1" fill="rgba(66, 168, 191, 0.15)" />
        <line x1="10" y1="6" x2="14" y2="6" />
        <line x1="10" y1="10" x2="14" y2="10" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>`;
    case "shorts":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <polygon points="10 8 15 12 10 16 10 8" fill="currentColor" />
      </svg>`;
    case "likes":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>`;
    case "auto":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M8 15h.01" stroke-width="3" />
        <path d="M16 15h.01" stroke-width="3" />
      </svg>`;
    case "cinema":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 8h20" />
        <path d="M6 4l2 4" />
        <path d="M12 4l2 4" />
        <path d="M18 4l2 4" />
      </svg>`;
    case "broadcast":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
        <path d="M7.76 7.76a6 6 0 0 1 8.48 0" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 14v8" />
      </svg>`;
    case "decade":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polygon points="12 7 15 12 12 17 9 12 12 7" fill="rgba(214, 179, 107, 0.3)" />
      </svg>`;
    case "mystery":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="3" />
      </svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10" /></svg>`;
  }
}

function initLegacy3DJourney() {
  const section = document.querySelector("#legacyJourney");
  const viewport = document.querySelector("#legacyViewport");
  const world = document.querySelector("#legacyWorld");
  const canvas = document.querySelector("#legacyCanvas");
  const hudYear = document.querySelector("#hudYear");
  const hudChapter = document.querySelector("#hudChapter");
  const hudBar = document.querySelector("#hudBar");
  if (!section || !viewport || !world) return;

  const MAX_Z = 34800;
  const elements = [];

  // Build 3D DOM nodes
  journeyChapters.forEach((chapter) => {
    // 1. Chapter gateway portal
    const gatewayEl = document.createElement("div");
    gatewayEl.className = "chapter-gateway";
    gatewayEl.innerHTML = `
      <div class="chapter-gateway__beam" aria-hidden="true"></div>
      <h3 class="chapter-gateway__year">${escapeHtml(chapter.year)}</h3>
      <span class="chapter-gateway__title">${escapeHtml(chapter.title)}</span>
    `;
    gatewayEl.style.transform = `translate3d(-50%, -50%, ${-chapter.z}px) translate3d(0, -110px, 0)`;
    world.appendChild(gatewayEl);

    elements.push({
      el: gatewayEl,
      z: chapter.z,
      isGateway: true,
      year: chapter.year,
      title: chapter.title,
    });

    // 2. Chapter milestones
    chapter.milestones.forEach((m) => {
      const nodeEl = document.createElement("div");

      if (m.isDestination) {
        nodeEl.className = "destination-monolith";
        nodeEl.innerHTML = `
          <div class="destination-monolith__frame">
            <span class="destination-monolith__label">${escapeHtml(m.badge)}</span>
            <h2 class="destination-monolith__title">${escapeHtml(m.title)}</h2>
            <div class="destination-monolith__sub">${escapeHtml(m.desc)}</div>
          </div>
        `;
        nodeEl.style.transform = `translate3d(-50%, -50%, ${-m.z}px)`;
      } else if (m.isMystery) {
        nodeEl.className = "destination-monolith";
        nodeEl.innerHTML = `
          <div class="destination-monolith__frame">
            <span class="destination-monolith__label">${escapeHtml(m.badge)}</span>
            <h2 class="destination-monolith__title">${escapeHtml(m.title)}</h2>
            <div class="destination-monolith__sub">${escapeHtml(m.desc)}</div>
            <div class="destination-monolith__mystery">
              <span class="destination-monolith__question">?</span>
              <span class="destination-monolith__dots">• • • • •</span>
            </div>
          </div>
        `;
        nodeEl.style.transform = `translate3d(-50%, -50%, ${-m.z}px)`;
      } else {
        const isMonolith = m.type === "monolith" || m.type === "crown";
        nodeEl.className = `milestone-node ${isMonolith ? "milestone-node--monolith" : ""}`;
        const isCyan = m.type === "unboxing" || m.type === "gaming" || m.type === "monolith";
        nodeEl.innerHTML = `
          <div class="milestone-node__plaque">
            <div class="milestone-node__glow" aria-hidden="true"></div>
            <span class="milestone-node__badge ${isCyan ? "milestone-node__badge--cyan" : ""}">${escapeHtml(m.badge)}</span>
            <div class="milestone-node__emblem">${getMilestoneIcon(m.type)}</div>
            <time class="milestone-node__date">${escapeHtml(m.date)}</time>
            <h4 class="milestone-node__title">${escapeHtml(m.title)}</h4>
            <p class="milestone-node__desc">${escapeHtml(m.desc)}</p>
          </div>
        `;
        nodeEl.style.transform = `translate3d(-50%, -50%, ${-m.z}px) translate3d(${m.x}px, ${m.y}px, 0) rotateY(${m.rotY}deg)`;
      }

      world.appendChild(nodeEl);
      elements.push({
        el: nodeEl,
        z: m.z,
        isGateway: false,
        isMystery: !!m.isMystery,
        isDestination: !!m.isDestination,
        year: chapter.year,
        title: chapter.title,
      });
    });
  });

  // Atmospheric background particle canvas
  let ctx = null;
  let particles = [];
  const initCanvas = () => {
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    if (ctx) ctx.scale(dpr, dpr);

    particles = Array.from({ length: 120 }, () => ({
      x: (Math.random() - 0.5) * window.innerWidth * 1.5,
      y: (Math.random() - 0.5) * window.innerHeight * 1.5,
      z: Math.random() * 2000 + 100,
      size: Math.random() * 2 + 0.8,
      alpha: Math.random() * 0.6 + 0.2,
    }));
  };
  initCanvas();
  window.addEventListener("resize", initCanvas);

  // Smooth scroll camera lerp state
  let currentZ = 0;
  let targetZ = 0;

  const updateCamera = () => {
    const p = scrollProgress(section, 0, 1);
    targetZ = p * MAX_Z;

    if (reducedMotion) {
      currentZ = targetZ;
    } else {
      currentZ += (targetZ - currentZ) * 0.085;
    }

    world.style.transform = `translate3d(0, 0, ${currentZ.toFixed(2)}px)`;

    // Update HUD indicator
    if (hudBar) {
      hudBar.style.width = `${(p * 100).toFixed(1)}%`;
    }

    // Determine current chapter in view
    let activeChapter = journeyChapters[0];
    for (let i = 0; i < journeyChapters.length; i++) {
      if (currentZ >= journeyChapters[i].z - 500) {
        activeChapter = journeyChapters[i];
      }
    }
    if (hudYear && hudYear.textContent !== activeChapter.year) {
      hudYear.textContent = activeChapter.year;
    }
    if (hudChapter && hudChapter.textContent !== activeChapter.title) {
      hudChapter.textContent = activeChapter.title;
    }

    // High performance distance culling & volumetric fog
    elements.forEach((item) => {
      const deltaZ = item.z - currentZ; // positive = ahead in distance

      if (item.isGateway) {
        if (deltaZ > 2400 || deltaZ < -350) {
          if (item.el.style.visibility !== "hidden") {
            item.el.style.visibility = "hidden";
          }
        } else {
          if (item.el.style.visibility !== "visible") {
            item.el.style.visibility = "visible";
          }
          let opacity = 1;
          if (deltaZ > 1200) {
            opacity = clamp((2400 - deltaZ) / 1200, 0, 1);
          } else if (deltaZ < 100) {
            opacity = clamp((350 + deltaZ) / 450, 0, 1);
          }
          item.el.style.opacity = opacity.toFixed(3);
        }
      } else if (item.isMystery) {
        // Mystery question mark milestone emerges only after passing the 10 Years milestone
        if (currentZ < 33200 || deltaZ > 1400 || deltaZ < -500) {
          if (item.el.style.visibility !== "hidden") {
            item.el.style.visibility = "hidden";
          }
        } else {
          if (item.el.style.visibility !== "visible") {
            item.el.style.visibility = "visible";
          }
          let opacity = 1;
          if (deltaZ > 600) {
            opacity = clamp((1400 - deltaZ) / 800, 0, 1);
          } else if (deltaZ < 0) {
            opacity = clamp((500 + deltaZ) / 500, 0, 1);
          }
          item.el.style.opacity = opacity.toFixed(3);
        }
      } else {
        if (deltaZ > 1900 || deltaZ < -500) {
          if (item.el.style.visibility !== "hidden") {
            item.el.style.visibility = "hidden";
          }
        } else {
          if (item.el.style.visibility !== "visible") {
            item.el.style.visibility = "visible";
          }
          let opacity = 1;
          if (deltaZ > 900) {
            opacity = clamp((1900 - deltaZ) / 1000, 0, 1);
          } else if (deltaZ < 0) {
            opacity = clamp((500 + deltaZ) / 500, 0, 1);
          }
          item.el.style.opacity = opacity.toFixed(3);
        }
      }
    });

    // Render atmospheric particles
    if (ctx && canvas) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Depth horizon glow
      const horizonGrad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
      horizonGrad.addColorStop(0, "rgba(214, 179, 107, 0.04)");
      horizonGrad.addColorStop(0.5, "rgba(66, 168, 191, 0.02)");
      horizonGrad.addColorStop(1, "rgba(3, 4, 4, 0)");
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, w, h);

      // Particle simulation
      const speed = Math.abs(targetZ - currentZ) * 0.04 + 1.2;
      ctx.fillStyle = "#f4efe4";
      particles.forEach((pt) => {
        pt.z -= speed;
        if (pt.z <= 20) {
          pt.z = 2000;
          pt.x = (Math.random() - 0.5) * w * 1.5;
          pt.y = (Math.random() - 0.5) * h * 1.5;
        }

        const k = 700 / pt.z;
        const px = w / 2 + pt.x * k;
        const py = h / 2 + pt.y * k;
        const size = Math.max(0.5, pt.size * k);

        if (px >= 0 && px <= w && py >= 0 && py <= h) {
          ctx.globalAlpha = pt.alpha * clamp((2000 - pt.z) / 1200, 0, 1);
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(updateCamera);
  };

  requestAnimationFrame(updateCamera);
}

function initReveals() {
  const items = document.querySelectorAll(".closing-film, .watch-film__copy");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.35 }
  );
  items.forEach((item) => observer.observe(item));
}

function initJourneyFinale() {
  const btnExplore = document.querySelector("#btnExploreJourney");
  if (btnExplore) {
    btnExplore.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector("#legacyJourney");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
}

if (reducedMotion) {
  document.documentElement.classList.add("reduced-motion");
}

initHeroScrub();
initEcosystemReveal();
initVideoBelt();
initLegacy3DJourney();
initReveals();
initJourneyFinale();
