const state = {
    allMedia: [],
    activeType: '',
    searchText: '',
    sortBy: 'newest',
    currentLightboxIndex: 0
};

const fileInput = document.getElementById('file-input');
const selectFilesBtn = document.getElementById('select-files-btn');
const searchInput = document.getElementById('search-input');
const sortBySelect = document.getElementById('sort-by');
const uploadStatus = document.getElementById('upload-status');
const gallery = document.getElementById('gallery');
const totalCount = document.getElementById('total-count');
const imageCount = document.getElementById('image-count');
const videoCount = document.getElementById('video-count');
const audioCount = document.getElementById('audio-count');
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxMeta = document.getElementById('lightbox-meta');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxClose = document.getElementById('lightbox-close');

selectFilesBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
searchInput.addEventListener('input', handleSearch);
sortBySelect.addEventListener('change', handleSort);

Array.from(document.querySelectorAll('.filter-chip')).forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        state.activeType = button.dataset.type;
        renderGallery();
    });
});

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
lightboxNext.addEventListener('click', () => navigateLightbox(1));
lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

document.addEventListener('keydown', event => {
    if (lightbox.classList.contains('visible')) {
        if (event.key === 'Escape') closeLightbox();
        if (event.key === 'ArrowLeft') navigateLightbox(-1);
        if (event.key === 'ArrowRight') navigateLightbox(1);
    }
});

async function loadMedia() {
    try {
        const response = await fetch('/api/media');
        state.allMedia = await response.json();
        renderGallery();
    } catch (error) {
        gallery.innerHTML = '<p class="empty-state">Errore nel caricamento dei media.</p>';
    }
}

function formatDateLabel(date) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = startOfToday - startOfItem;

    if (diff === 0) return 'Oggi';
    if (diff === 86400000) return 'Ieri';
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseItemDate(item) {
    if (item.metadata?.DateTimeOriginal) {
        const parsed = parseExifDate(item.metadata.DateTimeOriginal);
        if (parsed) return parsed;
    }
    return new Date(item.mtime * 1000);
}

function parseExifDate(exifText) {
    const [datePart, timePart] = exifText.split(' ');
    if (!datePart || !timePart) return null;
    const normalized = datePart.replace(/:/g, '-');
    const iso = `${normalized}T${timePart}`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortItems(items) {
    return items.slice().sort((a, b) => {
        if (state.sortBy === 'name') {
            return a.filename.localeCompare(b.filename, 'it', { numeric: true, sensitivity: 'base' });
        }
        const diff = b.mtime - a.mtime;
        return state.sortBy === 'oldest' ? -diff : diff;
    });
}

function filterItems() {
    return sortItems(state.allMedia).filter(item => {
        if (state.activeType && !item.mime.startsWith(state.activeType)) return false;
        if (state.searchText) {
            const search = state.searchText.toLowerCase();
            return item.filename.toLowerCase().includes(search) || item.mime.toLowerCase().includes(search);
        }
        return true;
    });
}

function renderGallery() {
    const items = filterItems();
    gallery.innerHTML = '';
    updateStats(items);

    if (!items.length) {
        gallery.innerHTML = '<p class="empty-state">Nessun file trovato. Prova a cambiare filtro o importa nuovi media.</p>';
        return;
    }

    const grouped = items.reduce((groups, item, index) => {
        const label = formatDateLabel(parseItemDate(item));
        if (!groups[label]) groups[label] = [];
        groups[label].push({ item, index });
        return groups;
    }, {});

    Object.entries(grouped).forEach(([label, group]) => {
        const section = document.createElement('section');
        section.className = 'group-section';
        section.innerHTML = `<div class="group-header"><h2>${label}</h2><span>${group.length} elementi</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'media-grid';

        group.forEach(data => {
            grid.appendChild(createMediaCard(data.item, data.index));
        });

        section.appendChild(grid);
        gallery.appendChild(section);
    });
}

function createMediaCard(item, index) {
    const card = document.createElement('button');
    card.className = 'media-card';
    card.type = 'button';
    card.setAttribute('aria-label', item.filename);
    card.addEventListener('click', () => openLightbox(index));

    const preview = document.createElement('div');
    preview.className = 'media-preview';

    if (item.mime.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = `/thumb/${item.filename}`;
        img.alt = item.filename;
        img.loading = 'lazy';
        preview.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = `media-placeholder ${item.mime.startsWith('video/') ? 'video' : 'audio'}`;
        placeholder.innerHTML = `<span>${item.mime.startsWith('video/') ? 'VIDEO' : 'AUDIO'}</span>`;
        preview.appendChild(placeholder);
    }

    const badge = document.createElement('div');
    badge.className = 'media-badge';
    badge.textContent = item.mime.startsWith('image/') ? 'IMG' : item.mime.startsWith('video/') ? 'VID' : 'AUD';

    const info = document.createElement('div');
    info.className = 'media-info';
    const title = document.createElement('strong');
    title.textContent = item.filename;
    const date = document.createElement('small');
    date.textContent = formatDateLabel(parseItemDate(item));
    info.appendChild(title);
    info.appendChild(date);

    card.appendChild(preview);
    card.appendChild(badge);
    card.appendChild(info);
    return card;
}

function updateStats(items) {
    const counts = items.reduce((acc, item) => {
        if (item.mime.startsWith('image/')) acc.images += 1;
        if (item.mime.startsWith('video/')) acc.videos += 1;
        if (item.mime.startsWith('audio/')) acc.audios += 1;
        return acc;
    }, { images: 0, videos: 0, audios: 0 });

    totalCount.textContent = `${items.length} elementi`;
    imageCount.textContent = `${counts.images} immagini`;
    videoCount.textContent = `${counts.videos} video`;
    audioCount.textContent = `${counts.audios} audio`;
}

function handleSearch(event) {
    state.searchText = event.target.value.trim();
    renderGallery();
}

function handleSort(event) {
    state.sortBy = event.target.value;
    renderGallery();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    uploadFiles(files);
    event.target.value = '';
}

async function uploadFiles(files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    uploadStatus.textContent = 'Caricamento in corso...';
    uploadStatus.classList.add('active');

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            uploadStatus.textContent = `Caricati ${result.uploaded.length} file.`;
            await loadMedia();
        } else {
            uploadStatus.textContent = 'Errore durante il caricamento.';
        }
    } catch (error) {
        uploadStatus.textContent = 'Errore di connessione.';
    }

    setTimeout(() => {
        uploadStatus.textContent = '';
        uploadStatus.classList.remove('active');
    }, 3000);
}

function openLightbox(index) {
    state.currentLightboxIndex = index;
    renderLightbox();
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
    lightbox.classList.remove('visible');
    lightbox.setAttribute('aria-hidden', 'true');
}

function navigateLightbox(direction) {
    const items = filterItems();
    state.currentLightboxIndex = (state.currentLightboxIndex + direction + items.length) % items.length;
    renderLightbox();
}

function renderLightbox() {
    const items = filterItems();
    const item = items[state.currentLightboxIndex];
    if (!item) return;

    lightboxTitle.textContent = item.filename;
    lightboxMeta.innerHTML = `
        <p><strong>Tipo:</strong> ${item.mime}</p>
        <p><strong>Dimensione:</strong> ${Math.round(item.size / 1024)} KB</p>
        <p><strong>Data:</strong> ${parseItemDate(item).toLocaleString('it-IT')}</p>
    `;

    if (item.mime.startsWith('image/')) {
        lightboxContent.innerHTML = `<img src="/media/${item.filename}" alt="${item.filename}">`;
    } else if (item.mime.startsWith('video/')) {
        lightboxContent.innerHTML = `<video controls autoplay src="/media/${item.filename}"></video>`;
    } else {
        lightboxContent.innerHTML = `<audio controls src="/media/${item.filename}"></audio>`;
    }
}

document.addEventListener('DOMContentLoaded', loadMedia);
