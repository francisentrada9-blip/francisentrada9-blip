/* ---------- Loading screen: 3D meteor field ---------- */
function initLoadingMeteors() {
    const canvas = document.getElementById('loading-canvas');
    if (!canvas || !canvas.getContext) {
        window.stopLoadingMeteors = () => {};
        return;
    }

    const ctx = canvas.getContext('2d');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width, height, dpr, cx, cy, focal;
    let rocks = [];
    let bgStars = [];
    let animationId = null;
    let startTime = null;

    const Z_FAR = 1800;
    const Z_NEAR = 40;

    const ROCK_COLORS = [
        [120, 108, 100], // grey stone
        [96, 82, 70],    // umber
        [140, 118, 96]   // sandstone
    ];

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        cx = width / 2;
        cy = height / 2;
        focal = Math.max(width, height) * 0.9;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // A fixed irregular polygon per rock gives it a consistent silhouette as it tumbles
    function makeRockShape() {
        const sides = 6 + Math.floor(Math.random() * 3);
        const pts = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = 0.7 + Math.random() * 0.5;
            pts.push({ angle, r });
        }
        return pts;
    }

    function makeRock(randomDepth) {
        const spread = 900;
        return {
            x: (Math.random() * 2 - 1) * spread,
            y: (Math.random() * 2 - 1) * spread,
            z: randomDepth ? Z_NEAR + Math.random() * (Z_FAR - Z_NEAR) : Z_FAR,
            speed: 5.5 + Math.random() * 4.5,
            baseSize: 14 + Math.random() * 22,
            shape: makeRockShape(),
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.03,
            rgb: ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)],
            prevProjected: null
        };
    }

    function makeBgStar() {
        const spread = 1400;
        return {
            x: (Math.random() * 2 - 1) * spread,
            y: (Math.random() * 2 - 1) * spread,
            z: Z_NEAR + Math.random() * (Z_FAR - Z_NEAR),
            speed: 1.2
        };
    }

    function buildScene() {
        const rockCount = Math.min(70, Math.max(28, Math.round((width * height) / 16000)));
        rocks = Array.from({ length: rockCount }, () => makeRock(true));
        bgStars = Array.from({ length: 140 }, makeBgStar);
    }

    function project(x, y, z) {
        const scale = focal / z;
        return { x: cx + x * scale, y: cy + y * scale, scale };
    }

    function drawRock(m) {
        const p = project(m.x, m.y, m.z);
        const size = m.baseSize * p.scale * 0.12;

        // Faint motion trail toward its previous position, for a sense of speed
        if (m.prevProjected) {
            const depth = 1 - (m.z - Z_NEAR) / (Z_FAR - Z_NEAR);
            ctx.strokeStyle = `rgba(255,170,110,${(0.12 + depth * 0.18).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.6, size * 0.25);
            ctx.beginPath();
            ctx.moveTo(m.prevProjected.x, m.prevProjected.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        m.prevProjected = { x: p.x, y: p.y };

        if (size < 0.4) return;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(m.rotation);

        ctx.beginPath();
        m.shape.forEach((pt, i) => {
            const px = Math.cos(pt.angle) * pt.r * size;
            const py = Math.sin(pt.angle) * pt.r * size;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();

        // Simple directional shading: gradient across the rock to fake a lit 3D surface
        const [r, g, b] = m.rgb;
        const grad = ctx.createLinearGradient(-size, -size, size, size);
        grad.addColorStop(0, `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 70)},${Math.min(255, b + 50)},0.95)`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},0.95)`);
        grad.addColorStop(1, `rgba(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)},0.95)`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Hot rim-light on the leading edge, brighter the closer it gets
        const depth = 1 - (m.z - Z_NEAR) / (Z_FAR - Z_NEAR);
        ctx.strokeStyle = `rgba(255,${170 - depth * 30},${90 - depth * 30},${(0.35 + depth * 0.5).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.5, size * 0.06);
        ctx.stroke();

        ctx.restore();
    }

    function drawBgStar(s) {
        const p = project(s.x, s.y, s.z);
        const depth = 1 - (s.z - Z_NEAR) / (Z_FAR - Z_NEAR);
        const r = 0.4 + depth * 1.1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(220,225,255,${(0.25 + depth * 0.5).toFixed(3)})`;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawVignette() {
        const grad = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.2, cx, cy, Math.max(width, height) * 0.7);
        grad.addColorStop(0, 'rgba(6,7,15,0)');
        grad.addColorStop(1, 'rgba(6,7,15,0.65)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    function draw(time) {
        if (startTime === null) startTime = time;
        const elapsed = time - startTime;

        // Trailing fade instead of a hard clear, so streaks blend smoothly
        ctx.fillStyle = 'rgba(6,7,15,0.35)';
        ctx.fillRect(0, 0, width, height);

        // Slow camera roll for a cinematic, banking flight-path feel
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(elapsed * 0.00006);
        ctx.translate(-cx, -cy);

        bgStars.forEach(s => {
            s.z -= s.speed;
            if (s.z <= Z_NEAR) Object.assign(s, makeBgStar(), { z: Z_FAR });
            drawBgStar(s);
        });

        rocks.forEach(m => {
            m.z -= m.speed;
            m.rotation += m.rotationSpeed;
            if (m.z <= Z_NEAR) {
                Object.assign(m, makeRock(false));
                m.prevProjected = null;
                return;
            }
            drawRock(m);
        });

        ctx.restore();
        drawVignette();

        animationId = requestAnimationFrame(draw);
    }

    function drawStaticFrame() {
        ctx.fillStyle = '#06070f';
        ctx.fillRect(0, 0, width, height);
        bgStars.forEach(drawBgStar);
        rocks.forEach(m => {
            const p = project(m.x, m.y, m.z);
            ctx.beginPath();
            ctx.fillStyle = `rgba(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]},0.85)`;
            ctx.arc(p.x, p.y, Math.max(1, m.baseSize * p.scale * 0.08), 0, Math.PI * 2);
            ctx.fill();
        });
        drawVignette();
    }

    resize();
    buildScene();

    if (prefersReducedMotion) {
        drawStaticFrame();
    } else {
        ctx.fillStyle = '#06070f';
        ctx.fillRect(0, 0, width, height);
        animationId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        buildScene();
    });

    window.stopLoadingMeteors = () => {
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
    };
}

document.addEventListener('DOMContentLoaded', initLoadingMeteors);

/* ---------- Animated galaxy background ---------- */
function initGalaxyBackground() {
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width, height, dpr;
    let stars = [];
    let nebulae = [];
    let shootingStars = [];
    let animationId = null;
    let running = !prefersReducedMotion;

    const STAR_COLORS = [
        'rgba(255,255,255,ALPHA)',   // white
        'rgba(203,213,255,ALPHA)',   // blue-white
        'rgba(255,244,214,ALPHA)',   // pale gold
        'rgba(186,215,255,ALPHA)'    // pale blue
    ];

    const NEBULA_COLORS = [
        [139, 123, 255], // violet
        [45, 212, 238],  // cyan
        [216, 70, 239]   // magenta
    ];

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildScene();
    }

    function buildScene() {
        const area = width * height;
        const starCount = Math.min(220, Math.round(area / 6500));

        stars = Array.from({ length: starCount }, () => {
            const layer = Math.random(); // 0 = far, 1 = near
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 0.4 + layer * 1.4,
                speed: 0.015 + layer * 0.09,
                drift: (0.3 + layer * 0.7),
                color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
                baseAlpha: 0.35 + Math.random() * 0.5,
                twinkleSpeed: 0.4 + Math.random() * 1.1,
                twinklePhase: Math.random() * Math.PI * 2
            };
        });

        nebulae = NEBULA_COLORS.map((rgb, i) => ({
            x: (0.2 + 0.3 * i) * width + (Math.random() - 0.5) * 200,
            y: (0.25 + 0.25 * i) * height + (Math.random() - 0.5) * 200,
            radius: Math.max(width, height) * (0.35 + Math.random() * 0.15),
            rgb,
            vx: (Math.random() - 0.5) * 0.03,
            vy: (Math.random() - 0.5) * 0.03,
            phase: Math.random() * Math.PI * 2
        }));

        shootingStars = [];
    }

    function maybeSpawnShootingStar(time) {
        if (Math.random() < 0.0025 && shootingStars.length < 2) {
            const startX = Math.random() * width * 0.6;
            const startY = Math.random() * height * 0.4;
            const angle = (Math.PI / 5) + Math.random() * (Math.PI / 10);
            shootingStars.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * 9,
                vy: Math.sin(angle) * 9,
                life: 0,
                maxLife: 40 + Math.random() * 20
            });
        }
    }

    function draw(time) {
        ctx.clearRect(0, 0, width, height);

        // Nebula clouds
        ctx.globalCompositeOperation = 'screen';
        nebulae.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < -n.radius * 0.3) n.x = width + n.radius * 0.3;
            if (n.x > width + n.radius * 0.3) n.x = -n.radius * 0.3;
            if (n.y < -n.radius * 0.3) n.y = height + n.radius * 0.3;
            if (n.y > height + n.radius * 0.3) n.y = -n.radius * 0.3;

            const pulse = 0.06 + Math.sin(time * 0.00015 + n.phase) * 0.015;
            const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            gradient.addColorStop(0, `rgba(${n.rgb[0]},${n.rgb[1]},${n.rgb[2]},${pulse})`);
            gradient.addColorStop(1, `rgba(${n.rgb[0]},${n.rgb[1]},${n.rgb[2]},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';

        // Stars, drifting diagonally with parallax + twinkle
        stars.forEach(s => {
            s.x -= s.speed * s.drift;
            s.y += s.speed * s.drift * 0.35;
            if (s.x < -5) s.x = width + 5;
            if (s.y > height + 5) s.y = -5;

            const twinkle = 0.5 + 0.5 * Math.sin(time * 0.001 * s.twinkleSpeed + s.twinklePhase);
            const alpha = s.baseAlpha * (0.5 + 0.5 * twinkle);

            ctx.beginPath();
            ctx.fillStyle = s.color.replace('ALPHA', alpha.toFixed(3));
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Shooting stars
        maybeSpawnShootingStar(time);
        shootingStars = shootingStars.filter(sh => sh.life < sh.maxLife);
        shootingStars.forEach(sh => {
            sh.x += sh.vx;
            sh.y += sh.vy;
            sh.life += 1;
            const fade = 1 - sh.life / sh.maxLife;
            ctx.strokeStyle = `rgba(255,255,255,${(0.65 * fade).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(sh.x, sh.y);
            ctx.lineTo(sh.x - sh.vx * 6, sh.y - sh.vy * 6);
            ctx.stroke();
        });

        if (running) {
            animationId = requestAnimationFrame(draw);
        }
    }

    function drawStaticFrame() {
        // Reduced-motion: render one still frame, no loop
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen';
        nebulae.forEach(n => {
            const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            gradient.addColorStop(0, `rgba(${n.rgb[0]},${n.rgb[1]},${n.rgb[2]},0.06)`);
            gradient.addColorStop(1, `rgba(${n.rgb[0]},${n.rgb[1]},${n.rgb[2]},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
        stars.forEach(s => {
            ctx.beginPath();
            ctx.fillStyle = s.color.replace('ALPHA', s.baseAlpha.toFixed(3));
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            if (prefersReducedMotion) drawStaticFrame();
        }, 150);
    });

    document.addEventListener('visibilitychange', () => {
        running = !document.hidden && !prefersReducedMotion;
        if (running && !animationId) {
            animationId = requestAnimationFrame(draw);
        }
    });

    resize();

    if (prefersReducedMotion) {
        drawStaticFrame();
    } else {
        animationId = requestAnimationFrame(draw);
    }
}

document.addEventListener('DOMContentLoaded', initGalaxyBackground);

const GITHUB_USERNAME = 'francisentrada9-blip';

/* ---------- Theme toggle (dark/light) ---------- */
(function initTheme() {
    const root = document.documentElement;
    const toggleBtn = document.getElementById('theme-toggle');
    const STORAGE_KEY = 'portfolio-theme';

    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const initialTheme = savedTheme || (prefersLight ? 'light' : 'dark');

    if (initialTheme === 'light') {
        root.setAttribute('data-theme', 'light');
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isLight = root.getAttribute('data-theme') === 'light';
            if (isLight) {
                root.removeAttribute('data-theme');
                localStorage.setItem(STORAGE_KEY, 'dark');
            } else {
                root.setAttribute('data-theme', 'light');
                localStorage.setItem(STORAGE_KEY, 'light');
            }
        });
    }
})();

/* ---------- Scroll reveal animations ---------- */
function initScrollReveal() {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;

    if (!('IntersectionObserver' in window)) {
        revealEls.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealEls.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', initScrollReveal);

async function fetchGitHubProfile() {
    try {
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`);
        if (!response.ok) throw new Error('User profile not found');
        const user = await response.json();

        document.getElementById('avatar').src = user.avatar_url;
        document.getElementById('name').textContent = user.name || GITHUB_USERNAME;
        document.getElementById('bio').textContent = user.bio || 'Web Developer & Open Source Enthusiast';
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

async function fetchGitHubRepos() {
    const container = document.getElementById('projects-container');

    try {
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12`);
        if (!response.ok) throw new Error('Failed to fetch repositories');

        const repos = await response.json();

        if (repos.length === 0) {
            container.innerHTML = '<div class="loading">No public repositories found.</div>';
            return;
        }

        container.innerHTML = '';

        repos.forEach((repo, index) => {
            const description = repo.description || 'No description provided for this repository.';
            const language = repo.language || 'Code';
            const card = document.createElement('div');
            card.className = 'project-card';
            card.style.animationDelay = `${Math.min(index * 0.06, 0.6)}s`;

            card.innerHTML = `
                <div>
                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="project-title">
                        <i class="far fa-folder"></i> ${repo.name}
                    </a>
                    <p class="project-desc">${description}</p>
                </div>
                <div class="project-footer">
                    <div class="project-lang">
                        <span class="lang-dot"></span>
                        <span>${language}</span>
                    </div>
                    <div class="project-stats">
                        <span><i class="far fa-star"></i> ${repo.stargazers_count}</span>
                        <span><i class="fas fa-code-branch"></i> ${repo.forks_count}</span>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching repos:', error);
        container.innerHTML = '<div class="error">Could not load repositories at this time. Please check back later.</div>';
    }
}

const readmeArticle = document.getElementById('readme-content');
const readmeTitle = document.getElementById('readme-title');
let readmeContent = null;

if (readmeArticle) {
    readmeContent = readmeArticle.querySelector('div') || document.createElement('div');
    if (!readmeArticle.querySelector('div')) {
        readmeArticle.appendChild(readmeContent);
    }
}

function renderReadme(markdown) {
    if (!readmeContent) return;

    markdown = markdown.replace(/<!--[\s\S]*?-->/g, '');

    function inline(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    const lines = markdown.split('\n');
    let html = '';
    let inList = false;

    function closeList() {
        if (inList) {
            html += '</ul>';
            inList = false;
        }
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === '') {
            closeList();
            continue;
        }

        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            closeList();
            const level = Math.min(heading[1].length + 1, 4);
            html += `<h${level}>${inline(heading[2])}</h${level}>`;
            continue;
        }

        const listItem = line.match(/^[-*]\s+(.*)$/);
        if (listItem) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += `<li>${inline(listItem[1])}</li>`;
            continue;
        }

        closeList();
        html += `<p>${inline(line)}</p>`;
    }

    closeList();
    readmeContent.innerHTML = html;
}

const profileLoaded = fetchGitHubProfile();
const reposLoaded = fetchGitHubRepos();

const readmeLoaded = (readmeTitle && readmeArticle)
    ? fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_USERNAME}/readme`, {
        headers: { Accept: 'application/vnd.github.raw+json' }
      })
        .then(response => {
            if (!response.ok) throw new Error('README could not be loaded');
            return response.text();
        })
        .then(markdown => {
            readmeTitle.textContent = 'About me';
            renderReadme(markdown);
        })
        .catch(() => {
            readmeTitle.textContent = 'About me';
            readmeContent.insertAdjacentHTML(
                'beforeend',
                '<p>Read the latest version on <a href="https://github.com/francisentrada9-blip" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>'
            );
        })
    : Promise.resolve();

/* ---------- Loading screen orchestration ---------- */
(function runLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingStatus = document.getElementById('loading-status');
    if (!loadingScreen) return;

    document.body.classList.add('is-loading');

    const MIN_DISPLAY_MS = 2200;
    const minDisplayTime = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_MS));

    const statusMessages = ['Entering orbit\u2026', 'Tracking debris field\u2026', 'Stabilizing approach\u2026'];
    let statusIndex = 0;
    const statusTimer = setInterval(() => {
        statusIndex = (statusIndex + 1) % statusMessages.length;
        if (loadingStatus) loadingStatus.textContent = statusMessages[statusIndex];
    }, 900);

    Promise.all([profileLoaded, reposLoaded, readmeLoaded, minDisplayTime])
        .catch(() => {}) // never block the reveal on a failed fetch
        .finally(() => {
            clearInterval(statusTimer);
            loadingScreen.classList.add('is-hidden');
            document.body.classList.remove('is-loading');
            window.stopLoadingMeteors && window.stopLoadingMeteors();
            loadingScreen.addEventListener('transitionend', () => {
                loadingScreen.remove();
            }, { once: true });
        });
})();
