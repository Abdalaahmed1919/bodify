/* ==========================================================================
   BODIFY — interactions
   Vanilla JS + GSAP + ScrollTrigger + Lenis
   --------------------------------------------------------------------------
   ملاحظات سريعة للتعديل:
   - عدد الفريمات: CONFIG.frameCount
   - السعر: CONFIG.product.price (اتركه null لو السعر عند الطلب)
   - صور الألوان: data-image داخل أزرار .swatch في index.html
   ========================================================================== */

(() => {
  "use strict";

  const CONFIG = {
    frameCount: 240,
    mobileBreakpoint: 700,
    desktopFrames: "frames/",
    mobileFrames: "frames-mobile/",
    product: {
      price: null, // مثال: 890
      currency: "EGP",
      name: "BODIFY Signature Cap",
    },
    // اربط endpoint حقيقي هنا لو حبيت تحوّل الفورم لطلب فعلي.
    orderEndpoint: "",
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const doc = document.documentElement;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isReduced =
    prefersReduced.matches || doc.classList.contains("reduced-motion");
  const isSmallScreen = window.matchMedia(
    `(max-width: ${CONFIG.mobileBreakpoint}px)`
  ).matches;

  const frameDir = isSmallScreen
    ? CONFIG.mobileFrames
    : CONFIG.desktopFrames;
  const frameURL = (index) =>
    `${frameDir}frame_${String(index + 1).padStart(4, "0")}.webp`;
  const frameURLs = Array.from({ length: CONFIG.frameCount }, (_, i) =>
    frameURL(i)
  );

  /* ---------- DOM ---------- */
  const loader = $("#loader");
  const loaderBar = $("#loaderBar");
  const loaderPercent = $("#loaderPercent");
  const loaderFrames = $("#loaderFrames");
  const loaderProgress = $("#loaderProgress");

  const nav = $("#siteNav");
  const hero = $("#film");
  const heroFrame = $("#heroFrame");
  const heroPoster = $("#heroPoster");
  const canvas = $("#heroCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const frameCounter = $("#frameCounter");
  const heroIndex = $("#heroIndex");
  const stageName = $("#stageName");
  const scrollCue = $("#scrollCue");

  const stages = $$(".stage");
  const steps = $$(".step");
  const stageNames = ["التفاصيل", "الشخصية", "الراحة", "المميزات"];

  const productSection = $("#product");
  const marquee = $("#story");
  const footer = $("#footer");

  const productImage = $("#productImage");
  const productImageNext = $("#productImageNext");
  const productColorName = $("#productColorName");
  const colorLabel = $("#colorLabel");
  const swatches = $$(".swatch");
  const productPrice = $("#productPrice");
  const orderPrice = $("#orderPrice");

  const orderBtn = $("#orderBtn");
  const orderModal = $("#orderModal");
  const orderPanel = $(".order__panel", orderModal);
  const orderForm = $("#orderForm");
  const orderFormWrap = $("#orderFormWrap");
  const orderSuccess = $("#orderSuccess");
  const orderSuccessText = $("#orderSuccessText");
  const orderImage = $("#orderImage");
  const orderColor = $("#orderColor");

  /* ---------- Canvas ---------- */
  const images = new Array(CONFIG.frameCount);
  let currentFrame = 0;
  let paintedFrame = -1;
  let drawRaf = 0;
  let canvasW = 0;
  let canvasH = 0;
  let dpr = 1;

  /* Tiny strips that softly continue the film above and below the portrait band. */
  const topStrip = document.createElement("canvas");
  const bottomStrip = document.createElement("canvas");
  const leftStrip = document.createElement("canvas");
  const rightStrip = document.createElement("canvas");
  topStrip.width = 16;
  topStrip.height = 1;
  bottomStrip.width = 16;
  bottomStrip.height = 1;
  leftStrip.width = 1;
  leftStrip.height = 16;
  rightStrip.width = 1;
  rightStrip.height = 16;
  const topStripCtx = topStrip.getContext("2d");
  const bottomStripCtx = bottomStrip.getContext("2d");
  const leftStripCtx = leftStrip.getContext("2d");
  const rightStripCtx = rightStrip.getContext("2d");

  function sizeCanvas() {
    if (!canvas || !ctx || !heroFrame) return;
    const rect = heroFrame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    canvasW = rect.width;
    canvasH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.75 : 2);

    const nextW = Math.round(canvasW * dpr);
    const nextH = Math.round(canvasH * dpr);

    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isSmallScreen ? "medium" : "high";
    paintedFrame = -1;
    paintFrame(currentFrame);
  }

  function paintFrame(index) {
    if (!ctx || !canvasW || !canvasH) return;

    const img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const portrait = canvasW / canvasH < 0.92;

    if (portrait) {
      /*
       * Portrait: a 16:9 "cover" crop would cut almost all of the cap away.
       * Draw the frame in a wide band that keeps the whole cap visible, then
       * continue its top/bottom edge pixels to fill the rest of the screen so
       * the film reads as one full-bleed image instead of a letterboxed card.
       */
      const topGuard = Math.min(canvasH * 0.1, 110);
      const bottomGuard = canvasH * 0.62;
      let bandW = canvasW * (canvasW < 520 ? 1.55 : 1.5);
      let bandH = (bandW * ih) / iw;
      const maxBandH = Math.max(canvasH * 0.2, bottomGuard - topGuard);

      if (bandH > maxBandH) {
        bandH = maxBandH;
        bandW = (bandH * iw) / ih;
      }

      const bandTop =
        topGuard + Math.max(0, bottomGuard - topGuard - bandH) * 0.45;
      const bandLeft = (canvasW - bandW) / 2;
      const feather = Math.min(28, bandH * 0.08);
      const edge = Math.max(4, Math.round(ih * 0.014));

      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, bandLeft, bandTop, bandW, bandH);

      // Feather the band so it melts into the ambient fill below.
      ctx.globalCompositeOperation = "destination-out";

      let fade = ctx.createLinearGradient(0, bandTop, 0, bandTop + feather);
      fade.addColorStop(0, "rgba(0, 0, 0, 1)");
      fade.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fade;
      ctx.fillRect(bandLeft, bandTop, bandW, feather);

      fade = ctx.createLinearGradient(
        0,
        bandTop + bandH - feather,
        0,
        bandTop + bandH
      );
      fade.addColorStop(0, "rgba(0, 0, 0, 0)");
      fade.addColorStop(1, "rgba(0, 0, 0, 1)");
      ctx.fillStyle = fade;
      ctx.fillRect(bandLeft, bandTop + bandH - feather, bandW, feather);

      // Smooth colour continuations of the frame's top/bottom edges.
      topStripCtx.clearRect(0, 0, 16, 1);
      bottomStripCtx.clearRect(0, 0, 16, 1);
      topStripCtx.drawImage(img, 0, 0, iw, edge, 0, 0, 16, 1);
      bottomStripCtx.drawImage(
        img,
        0,
        ih - edge,
        iw,
        edge,
        0,
        0,
        16,
        1
      );

      ctx.globalCompositeOperation = "destination-over";
      ctx.drawImage(topStrip, bandLeft, 0, bandW, bandTop + feather);
      ctx.drawImage(
        bottomStrip,
        bandLeft,
        bandTop + bandH - feather,
        bandW,
        canvasH - (bandTop + bandH - feather)
      );

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(241, 236, 227, 0.2)";
      ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (canvasH < 560 && canvasW / canvasH > 1.6) {
      /*
       * Short landscape: fitting by height keeps the whole cap above the copy.
       * The narrow side gaps are continued from the frame's edge columns.
       */
      const shortScale = canvasH / ih;
      const shortW = iw * shortScale;
      const shortLeft = (canvasW - shortW) / 2;
      const feather = Math.min(32, shortW * 0.05);
      const edge = Math.max(4, Math.round(iw * 0.008));

      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, shortLeft, 0, shortW, canvasH);

      ctx.globalCompositeOperation = "destination-out";

      let fade = ctx.createLinearGradient(
        shortLeft,
        0,
        shortLeft + feather,
        0
      );
      fade.addColorStop(0, "rgba(0, 0, 0, 1)");
      fade.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fade;
      ctx.fillRect(shortLeft, 0, feather, canvasH);

      fade = ctx.createLinearGradient(
        shortLeft + shortW - feather,
        0,
        shortLeft + shortW,
        0
      );
      fade.addColorStop(0, "rgba(0, 0, 0, 0)");
      fade.addColorStop(1, "rgba(0, 0, 0, 1)");
      ctx.fillStyle = fade;
      ctx.fillRect(shortLeft + shortW - feather, 0, feather, canvasH);

      leftStripCtx.clearRect(0, 0, 1, 16);
      rightStripCtx.clearRect(0, 0, 1, 16);
      leftStripCtx.drawImage(img, 0, 0, edge, ih, 0, 0, 1, 16);
      rightStripCtx.drawImage(img, iw - edge, 0, edge, ih, 0, 0, 1, 16);

      ctx.globalCompositeOperation = "destination-over";
      ctx.drawImage(leftStrip, 0, 0, shortLeft + feather, canvasH);
      ctx.drawImage(
        rightStrip,
        shortLeft + shortW - feather,
        0,
        canvasW - (shortLeft + shortW - feather),
        canvasH
      );

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(241, 236, 227, 0.16)";
      ctx.fillRect(0, 0, canvasW, canvasH);
    } else {
      const scale = Math.max(canvasW / iw, canvasH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (canvasW - dw) / 2;
      const dy = (canvasH - dh) / 2;

      ctx.fillStyle = "#e9e1d3";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    paintedFrame = index;
    heroFrame.classList.add("is-ready");
  }

  function drawFrame(index, force = false) {
    const clamped = Math.max(0, Math.min(CONFIG.frameCount - 1, index));

    if (!force && clamped === currentFrame) return;
    currentFrame = clamped;

    if (frameCounter) {
      frameCounter.textContent = String(clamped + 1).padStart(3, "0");
    }

    if (drawRaf) return;
    drawRaf = requestAnimationFrame(() => {
      drawRaf = 0;
      if (paintedFrame !== currentFrame) paintFrame(currentFrame);
    });
  }

  function watchCanvasSize() {
    if (!heroFrame) return;

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => {
        if (!canvasW && !heroFrame.getBoundingClientRect().width) return;
        sizeCanvas();
      });
      ro.observe(heroFrame);
    } else {
      let resizeTimer = 0;
      window.addEventListener(
        "resize",
        () => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(sizeCanvas, 150);
        },
        { passive: true }
      );
    }

    window.addEventListener("orientationchange", () => {
      window.setTimeout(sizeCanvas, 250);
    });
  }

  /* ---------- Preload ---------- */
  function loadImage(url, attempt = 0) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";

      img.onload = () => resolve({ img, ok: true });
      img.onerror = () => {
        if (attempt < 1) {
          resolve(loadImage(url, attempt + 1));
        } else {
          resolve({ img: null, ok: false });
        }
      };

      img.src = url;
    });
  }

  function updateLoader(done, total) {
    const ratio = total ? done / total : 0;
    const percent = Math.min(100, Math.round(ratio * 100));

    if (loaderBar) loaderBar.style.transform = `scaleX(${ratio})`;
    if (loaderPercent)
      loaderPercent.textContent = String(percent).padStart(2, "0");
    if (loaderFrames)
      loaderFrames.textContent = String(done).padStart(3, "0");
    if (loaderProgress) loaderProgress.setAttribute("aria-valuenow", percent);
  }

  async function preloadFrames(urls, onProgress) {
    const result = new Array(urls.length);
    const total = urls.length;
    let cursor = 0;
    let done = 0;

    const workerCount = Math.min(8, total);

    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < total) {
        const index = cursor;
        cursor += 1;

        const { img, ok } = await loadImage(urls[index]);
        if (ok && img) result[index] = img;

        done += 1;
        onProgress(done, total, index, ok);
      }
    });

    await Promise.all(workers);
    return result;
  }

  function loaderExit(animated = true) {
    if (!loader) return Promise.resolve();

    return new Promise((resolve) => {
      const done = () => {
        loader.classList.add("is-done");
        loader.style.display = "none";
        loader.setAttribute("aria-busy", "false");
        resolve();
      };

      if (!animated || !window.gsap || isReduced) {
        done();
        return;
      }

      const tl = window.gsap.timeline({ onComplete: done });
      tl.to(".loader__center", {
        autoAlpha: 0,
        y: -20,
        duration: 0.45,
        ease: "power2.inOut",
      })
        .to(
          [".loader__bottom", ".loader__top"],
          { autoAlpha: 0, duration: 0.3, ease: "power2.inOut" },
          "<"
        )
        .to(
          loader,
          { yPercent: -100, duration: 1, ease: "power4.inOut" },
          "-=0.05"
        )
        .add(() => {
          // Reveal the page underneath while the curtain is still moving.
          doc.classList.remove("is-loading");
          bootScroll();
          playIntro();
        }, "-=0.62");
    });
  }

  /* ---------- Smooth scroll + hero timeline ---------- */
  let lenis = null;
  let scrollBooted = false;
  let heroTimeline = null;
  let introPlayed = false;
  let activeStage = -1;
  let lastFocus = null;

  function bootScroll() {
    if (scrollBooted) return;
    scrollBooted = true;

    if (isReduced || !window.gsap || !window.ScrollTrigger) {
      window.ScrollTrigger && window.ScrollTrigger.refresh();
      return;
    }

    if (window.Lenis && !lenis) {
      try {
        lenis = new window.Lenis({
          autoRaf: false,
          lerp: 0.09,
          smoothWheel: true,
          wheelMultiplier: 0.95,
          touchMultiplier: 1.35,
        });

        lenis.on("scroll", window.ScrollTrigger.update);

        const raf = (time) => lenis.raf(time * 1000);
        window.gsap.ticker.add(raf);
        window.gsap.ticker.lagSmoothing(0);
      } catch (error) {
        lenis = null;
      }
    }

    window.ScrollTrigger.refresh();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => window.ScrollTrigger.refresh());
    }
  }

  function updateHeroUI(progress) {
    const index =
      progress < 0.2 ? 0 : progress < 0.445 ? 1 : progress < 0.67 ? 2 : 3;

    if (index !== activeStage) {
      activeStage = index;

      if (heroIndex) {
        heroIndex.textContent = String(index + 1).padStart(2, "0");
      }
      if (stageName) {
        stageName.textContent = stageNames[index];
      }

      steps.forEach((step, stepIndex) => {
        step.classList.toggle("is-active", stepIndex === index);
      });
    }

    if (scrollCue) {
      scrollCue.style.opacity = progress > 0.012 ? "0" : "1";
    }

    if (hero) {
      hero.classList.toggle("is-complete", progress > 0.99);
    }
  }

  function setupHeroTimeline() {
    if (!window.gsap || !window.ScrollTrigger || !hero) return;

    const { gsap } = window;
    const ScrollTrigger = window.ScrollTrigger;

    ScrollTrigger.config({ ignoreMobileResize: true });
    gsap.registerPlugin(ScrollTrigger);

    const frameState = { frame: 0 };
    const stage1 = $(".stage--1");
    const stage2 = $(".stage--2");
    const stage3 = $(".stage--3");
    const stage4 = $(".stage--4");
    const stage2Lines = $$(".line__inner", stage2);
    const stage3Lines = $$(".line__inner", stage3);
    const features = $$(".feature", stage4);
    const stage4Link = $(".stage__link", stage4);

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom bottom",
        scrub: isSmallScreen ? 0.35 : 0.45,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateHeroUI(self.progress),
        onRefresh: (self) => {
          updateHeroUI(self.progress);
          drawFrame(
            Math.round(self.progress * (CONFIG.frameCount - 1)),
            true
          );
        },
      },
    });

    // The cap sequence owns the whole pinned scroll distance.
    tl.to(
      frameState,
      {
        frame: CONFIG.frameCount - 1,
        duration: 1,
        ease: "none",
        onUpdate: () => drawFrame(Math.round(frameState.frame)),
      },
      0
    );

    // Stage 1 — visible on load, fades out as the first cut begins.
    tl.to(
      stage1,
      { autoAlpha: 0, y: -24, duration: 0.055, ease: "power1.in" },
      0.155
    );

    // Stage 2
    tl.fromTo(
      stage2,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.045 },
      0.205
    )
      .fromTo(
        stage2Lines,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.038, stagger: 0.008 },
        0.21
      )
      .to(stage2, { autoAlpha: 0, y: -24, duration: 0.045 }, 0.4);

    // Stage 3
    tl.fromTo(
      stage3,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.045 },
      0.45
    )
      .fromTo(
        stage3Lines,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.038, stagger: 0.008 },
        0.455
      )
      .to(stage3, { autoAlpha: 0, y: -24, duration: 0.045 }, 0.645);

    // Stage 4 — features reveal one by one and stay for reading.
    tl.fromTo(
      stage4,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.045 },
      0.675
    );

    features.forEach((feature, index) => {
      tl.fromTo(
        feature,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.035 },
        0.725 + index * 0.07
      );
    });

    if (stage4Link) {
      tl.fromTo(
        stage4Link,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.03 },
        0.935
      );
    }

    heroTimeline = tl;
    updateHeroUI(0);
  }

  function playIntro() {
    if (introPlayed || isReduced || !window.gsap) return;
    introPlayed = true;

    const { gsap } = window;
    const stage1 = $(".stage--1");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      heroFrame,
      { clipPath: "inset(0 0 100% 0)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1.35,
        ease: "power4.inOut",
        onComplete: () => gsap.set(heroFrame, { clearProps: "clipPath" }),
      },
      0
    )
      .from(
        ".hero__frame-ui",
        { autoAlpha: 0, duration: 0.8 },
        0.7
      )
      .from(
        ".hero__caption",
        { autoAlpha: 0, y: 8, duration: 0.7 },
        0.78
      )
      .from(
        ".hero__meta",
        { autoAlpha: 0, y: 10, duration: 0.8 },
        0.3
      )
      .from(
        ".stage--1 .stage__kicker",
        { autoAlpha: 0, y: 10, duration: 0.8 },
        0.35
      );

    const lines = $$(".line__inner", stage1);
    tl.fromTo(
      lines,
      { yPercent: 110 },
      { yPercent: 0, duration: 1.1, stagger: 0.09, ease: "power4.out" },
      0.42
    );

    tl.from(
      ".stage--1 .stage__desc",
      { autoAlpha: 0, y: 12, duration: 0.85 },
      0.86
    )
      .from(
        ".hero__foot",
        { autoAlpha: 0, y: 12, duration: 0.8 },
        0.9
      )
      .from(
        ".hero__side",
        { autoAlpha: 0, duration: 1 },
        1.0
      );
  }

  function activateStaticExperience() {
    doc.classList.add("reduced-motion");
    if (images[CONFIG.frameCount - 1]) {
      drawFrame(CONFIG.frameCount - 1, true);
    }
  }

  /* ---------- Navbar theme + smooth anchors ---------- */
  let navTick = false;

  function updateNav() {
    if (!nav) return;

    const y = window.scrollY || window.pageYOffset || 0;
    nav.classList.toggle("is-scrolled", y > 42);

    // The bar stays out of the film and only enters once the sequence is done.
    const reduced = doc.classList.contains("reduced-motion");
    const heroDone =
      !hero || hero.getBoundingClientRect().bottom <= window.innerHeight + 2;
    nav.classList.toggle("is-hidden", !reduced && !heroDone);

    const navLine = 52;
    const overDark = [marquee, productSection, footer].some((section) => {
      if (!section) return false;
      const rect = section.getBoundingClientRect();
      return rect.top <= navLine && rect.bottom >= navLine;
    });

    nav.classList.toggle("is-light", overDark);
  }

  function scheduleNavUpdate() {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(() => {
      navTick = false;
      updateNav();
    });
  }

  function setupNav() {
    updateNav();
    window.addEventListener("scroll", scheduleNavUpdate, { passive: true });
    window.addEventListener("resize", scheduleNavUpdate, { passive: true });
  }

  function setupAnchors() {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();

        if (lenis) {
          lenis.scrollTo(target, { offset: -68, duration: 1.35 });
        } else if (!isReduced) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }
      });
    });
  }

  /* ---------- Product ---------- */
  let activeProductLayer = null;
  let colorSwapToken = 0;
  let colorSwapTimer = 0;

  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return "";
    const amount = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
    return `${amount} ${CONFIG.product.currency}`;
  }

  function setProductPrice() {
    const formatted = formatPrice(CONFIG.product.price);
    if (!formatted) return;

    if (productPrice) {
      productPrice.textContent = formatted;
      productPrice.classList.add("is-numeric");
    }
    if (orderPrice) orderPrice.textContent = formatted;
  }

  function updateSelectionUI(button) {
    const color = button.dataset.color;
    const name = button.dataset.name || color;
    const src = button.dataset.image;

    swatches.forEach((swatch) => {
      swatch.setAttribute(
        "aria-pressed",
        swatch === button ? "true" : "false"
      );
    });

    if (productColorName) productColorName.textContent = color;
    if (colorLabel) colorLabel.textContent = `${color} — ${name}`;
    if (orderColor) orderColor.textContent = `${color} — ${name}`;

    if (orderImage && src) {
      orderImage.src = src;
      orderImage.alt = `كاب Bodify Signature بلون ${name}`;
    }
  }

  function selectColor(button) {
    if (!button) return;

    const src = button.dataset.image;
    if (!src) return;

    updateSelectionUI(button);

    if (!productImage || !productImageNext) return;

    const currentLayer = activeProductLayer || productImage;
    const incoming =
      currentLayer === productImage ? productImageNext : productImage;

    if (currentLayer.dataset.src === src) {
      return;
    }

    const token = (colorSwapToken += 1);
    const name = button.dataset.name || button.dataset.color;

    incoming.dataset.src = src;
    incoming.src = src;
    incoming.alt = `كاب Bodify Signature بلون ${name}`;
    incoming.removeAttribute("aria-hidden");

    const reveal = () => {
      if (token !== colorSwapToken) return;

      incoming.style.zIndex = "3";
      incoming.classList.add("is-active");

      currentLayer.classList.remove("is-active");
      currentLayer.style.zIndex = "2";
      currentLayer.alt = "";
      currentLayer.setAttribute("aria-hidden", "true");

      activeProductLayer = incoming;

      window.clearTimeout(colorSwapTimer);
      colorSwapTimer = window.setTimeout(() => {
        incoming.style.zIndex = "";
        currentLayer.style.zIndex = "";
      }, 760);
    };

    if (incoming.complete && incoming.naturalWidth) {
      requestAnimationFrame(reveal);
    } else {
      incoming.addEventListener("load", reveal, { once: true });
    }

    // Warm the browser cache for the other colorways.
    swatches.forEach((swatch) => {
      if (swatch === button) return;
      const preload = new Image();
      preload.src = swatch.dataset.image;
    });
  }

  function setupProduct() {
    activeProductLayer = productImage;
    if (productImage) {
      productImage.dataset.src = productImage.getAttribute("src");
    }

    setProductPrice();

    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => selectColor(swatch));
    });

    setupOrderModal();
  }

  function setupReveals() {
    if (isReduced || !window.gsap || !window.ScrollTrigger) return;

    const { gsap } = window;
    const ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    gsap.from(".product__head", {
      autoAlpha: 0,
      y: 18,
      duration: 0.9,
      ease: "power2.out",
      scrollTrigger: {
        trigger: productSection,
        start: "top 78%",
        once: true,
      },
    });

    gsap.from(".product__media", {
      autoAlpha: 0,
      y: 44,
      duration: 1.15,
      ease: "power3.out",
      scrollTrigger: {
        trigger: productSection,
        start: "top 76%",
        once: true,
      },
    });

    gsap.from(".product__info > *", {
      autoAlpha: 0,
      y: 22,
      duration: 0.85,
      stagger: 0.065,
      ease: "power2.out",
      scrollTrigger: {
        trigger: productSection,
        start: "top 72%",
        once: true,
      },
    });

    gsap.from(".footer__word", {
      autoAlpha: 0,
      yPercent: 14,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: footer,
        start: "top 92%",
        once: true,
      },
    });
  }

  /* ---------- Order modal ---------- */
  function setupOrderModal() {
    if (!orderBtn || !orderModal || !orderPanel) return;

    const closeButtons = $$("[data-close-order]", orderModal);

    orderBtn.addEventListener("click", openOrder);
    closeButtons.forEach((button) =>
      button.addEventListener("click", closeOrder)
    );

    orderModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOrder();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = $$(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        orderPanel
      ).filter((element) => element.offsetParent !== null);

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });

    if (orderForm) {
      orderForm.addEventListener("submit", handleOrderSubmit);
    }
  }

  function openOrder() {
    if (!orderModal || !orderPanel) return;
    if (orderModal.classList.contains("is-open")) return;

    lastFocus = document.activeElement;

    orderModal.classList.add("is-open");
    orderModal.setAttribute("aria-hidden", "false");
    doc.classList.add("is-modal-open");

    if (lenis) lenis.stop();

    const firstField = orderForm ? $("input", orderForm) : null;

    window.setTimeout(() => {
      if (orderSuccess && !orderSuccess.hidden) {
        const button = $("button", orderSuccess);
        button && button.focus();
      } else if (firstField) {
        firstField.focus({ preventScroll: true });
      }
    }, 180);
  }

  function closeOrder() {
    if (!orderModal || !orderModal.classList.contains("is-open")) return;

    orderModal.classList.remove("is-open");
    orderModal.setAttribute("aria-hidden", "true");
    doc.classList.remove("is-modal-open");

    if (lenis) lenis.start();

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }

    window.setTimeout(() => {
      if (orderModal.classList.contains("is-open")) return;
      if (orderForm) orderForm.reset();
      if (orderFormWrap) orderFormWrap.hidden = false;
      if (orderSuccess) orderSuccess.hidden = true;
      if (orderError) {
        orderError.hidden = true;
        orderError.textContent = "";
      }
      const submit = orderForm && $('button[type="submit"]', orderForm);
      if (submit) {
        submit.disabled = false;
        const label = $("span", submit);
        if (label) label.textContent = "تأكيد الطلب";
      }
    }, 460);
  }

  const orderError = $("#orderError");

  async function handleOrderSubmit(event) {
    event.preventDefault();
    if (!orderForm) return;

    if (!orderForm.checkValidity()) {
      orderForm.reportValidity();
      return;
    }

    const submit = $('button[type="submit"]', orderForm);
    const label = submit ? $("span", submit) : null;
    const originalLabel = label ? label.textContent : "";

    const data = Object.fromEntries(new FormData(orderForm).entries());
    const activeSwatch = swatches.find(
      (swatch) => swatch.getAttribute("aria-pressed") === "true"
    );

    const payload = {
      product: CONFIG.product.name,
      price: formatPrice(CONFIG.product.price) || "on-request",
      color: activeSwatch
        ? `${activeSwatch.dataset.color} — ${activeSwatch.dataset.name}`
        : null,
      size: "One Size / Adjustable",
      quantity: Number(data.quantity || 1),
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      city: String(data.city || "").trim(),
    };

    if (submit) submit.disabled = true;
    if (label) label.textContent = "جاري الإرسال...";
    if (orderError) orderError.hidden = true;

    try {
      if (CONFIG.orderEndpoint) {
        const response = await fetch(CONFIG.orderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Order request failed");
      } else {
        // Demo mode: no backend connected.
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        console.info("BODIFY — order request (demo)", payload);
      }

      if (orderFormWrap) orderFormWrap.hidden = true;
      if (orderSuccess) orderSuccess.hidden = false;
      if (orderSuccessText) {
        orderSuccessText.textContent = `شكرًا ${payload.name}، هنرجعلك على ${payload.phone} لتأكيد الطلب والتفاصيل.`;
      }

      const successButton = orderSuccess && $("button", orderSuccess);
      if (successButton) {
        window.setTimeout(
          () => successButton.focus({ preventScroll: true }),
          80
        );
      }
    } catch (error) {
      if (label) label.textContent = originalLabel;
      if (submit) submit.disabled = false;
      if (orderError) {
        orderError.textContent =
          "حصلت مشكلة في إرسال الطلب. جرّب تاني أو تواصل معنا.";
        orderError.hidden = false;
      }
    }
  }

  /* ---------- Boot ---------- */
  async function initReduced() {
    const finalIndex = CONFIG.frameCount - 1;
    updateLoader(0, 1);

    const { img } = await loadImage(frameURLs[finalIndex]);
    if (img) images[finalIndex] = img;

    updateLoader(1, 1);
    if (loaderFrames) loaderFrames.textContent = String(CONFIG.frameCount);

    const started = performance.now();
    const elapsed = performance.now() - started;
    if (elapsed < 400) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 400 - elapsed)
      );
    }

    sizeCanvas();
    drawFrame(finalIndex, true);

    await loaderExit(false);
    doc.classList.remove("is-loading");
  }

  async function init() {
    watchCanvasSize();
    setupNav();
    setupProduct();
    setupAnchors();

    if (isReduced) {
      await initReduced();
      return;
    }

    try {
      const started = performance.now();
      const loadedImages = await preloadFrames(
        frameURLs,
        (done, total) => updateLoader(done, total)
      );

      loadedImages.forEach((img, index) => {
        if (img) images[index] = img;
      });

      const elapsed = performance.now() - started;
      if (elapsed < 850) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 850 - elapsed)
        );
      }

      sizeCanvas();
      drawFrame(0, true);

      if (!window.gsap || !window.ScrollTrigger) {
        activateStaticExperience();
        await loaderExit(false);
        doc.classList.remove("is-loading");
        return;
      }

      setupHeroTimeline();
      setupReveals();
      await loaderExit(true);
    } catch (error) {
      console.error("BODIFY — failed to start the experience", error);
      activateStaticExperience();
      await loaderExit(false);
      doc.classList.remove("is-loading");
    }
  }

  // Fonts finishing after ScrollTrigger's first measure can shift layout.
  window.addEventListener("load", () => {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
