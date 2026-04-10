const state = {
    allMedia: [],
    activeType: '',
    searchText: '',
    sortBy: 'newest',
    currentAlbum: '',
    currentLightboxIndex: 0,
    mediaRoot: ''
};

const fileInput = document.getElementById('file-input');
const selectFilesBtn = document.getElementById('select-files-btn');
const folderPathInput = document.getElementById('folder-path-input');
const setFolderBtn = document.getElementById('set-folder-btn');
const searchInput = document.getElementById('search-input');
const sortBySelect = document.getElementById('sort-by');
const uploadStatus = document.getElementById('upload-status');
const breadcrumb = document.getElementById('breadcrumb');
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
setFolderBtn.addEventListener('click', setMediaFolder);
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
        const result = await response.json();
        state.allMedia = result.media || [];
        state.mediaRoot = result.root || state.mediaRoot;
        renderGallery();
    } catch (error) {
        gallery.innerHTML = '<p class="empty-state">Errore nel caricamento dei media.</p>';
    }
}

async function setMediaFolder() {
    const root = folderPathInput.value.trim();
    if (!root) {
        uploadStatus.textContent = 'Inserisci prima il percorso della cartella.';
        uploadStatus.classList.add('active');
        setTimeout(() => {
            uploadStatus.textContent = '';
            uploadStatus.classList.remove('active');
        }, 3000);
        return;
    }

    try {
        const response = await fetch('/api/set-root', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ root })
        });
        const result = await response.json();
        if (result.success) {
            uploadStatus.textContent = `Cartella impostata su: ${result.root}`;
            await loadMedia();
        } else {
            uploadStatus.textContent = result.error || 'Errore impostando la cartella.';
        }
    } catch (error) {
        console.error('Set folder failed:', error);
        uploadStatus.textContent = 'Errore di connessione durante l’impostazione della cartella.';
    }

    uploadStatus.classList.add('active');
    setTimeout(() => {
        uploadStatus.textContent = '';
        uploadStatus.classList.remove('active');
    }, 4000);
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

function getFilteredItems() {
    return sortItems(state.allMedia).filter(item => {
        if (state.activeType && !item.mime.startsWith(state.activeType)) return false;
        if (state.searchText) {
            const search = state.searchText.toLowerCase();
            return item.filename.toLowerCase().includes(search) || item.mime.toLowerCase().includes(search);
        }
        return true;
    });
}

function getVisibleMediaItems() {
    return getFilteredItems().filter(item => item.folder === state.currentAlbum);
}

function getAlbumsForCurrentFolder(items) {
    const prefix = state.currentAlbum ? `${state.currentAlbum}/` : '';
    const albums = {};

    items.forEach(item => {
        if (!item.folder.startsWith(prefix) || item.folder === state.currentAlbum) return;
        const remainder = item.folder.slice(prefix.length);
        const segments = remainder.split('/').filter(Boolean);
        if (!segments.length) return;
        const childPath = prefix + segments[0];
        if (!albums[childPath]) {
            albums[childPath] = {
                path: childPath,
                label: segments[0],
                count: 0
            };
        }
        albums[childPath].count += 1;
    });

    return Object.values(albums).sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true, sensitivity: 'base' }));
}

function renderBreadcrumb() {
    if (!breadcrumb) return;

    const rootLabel = state.mediaRoot ? `Cartella: ${state.mediaRoot}` : 'Radice';
    if (!state.currentAlbum) {
        breadcrumb.innerHTML = `<div class="breadcrumb-item active">${rootLabel}</div>`;
        return;
    }

    const segments = state.currentAlbum.split('/');
    let path = '';
    const items = segments.map((segment, index) => {
        path = path ? `${path}/${segment}` : segment;
        return `<button type="button" class="breadcrumb-item" data-path="${path}">${segment}</button>`;
    });

    breadcrumb.innerHTML = `
        <button type="button" class="breadcrumb-item" data-path="">Radice</button>
        <span class="breadcrumb-separator">/</span>
        ${items.join('<span class="breadcrumb-separator">/</span>')}
    `;

    breadcrumb.querySelectorAll('.breadcrumb-item').forEach(button => {
        button.addEventListener('click', () => {
            state.currentAlbum = button.dataset.path;
            renderGallery();
        });
    });
}

function renderGallery() {
    const filteredItems = getFilteredItems();
    const albums = getAlbumsForCurrentFolder(filteredItems);
    const items = getVisibleMediaItems();

    gallery.innerHTML = '';
    renderBreadcrumb();
    updateStats(items);

    if (albums.length) {
        const albumSection = document.createElement('section');
        albumSection.className = 'group-section';
        albumSection.innerHTML = `<div class="group-header"><h2>Album</h2><span>${albums.length} cartelle</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'media-grid';
        albums.forEach(album => grid.appendChild(createAlbumCard(album)));
        albumSection.appendChild(grid);
        gallery.appendChild(albumSection);
    }

    if (!items.length && !albums.length) {
        gallery.innerHTML = '<p class="empty-state">Nessun media o album in questa cartella. Prova a selezionare un altro album o importa nuovi file.</p>';
        return;
    }

    if (items.length) {
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
        img.src = `/thumb/${item.relative_path}`;
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

function createAlbumCard(album) {
    const card = document.createElement('button');
    card.className = 'media-card album-card';
    card.type = 'button';
    card.setAttribute('aria-label', album.label);
    card.addEventListener('click', () => {
        state.currentAlbum = album.path;
        renderGallery();
    });

    const preview = document.createElement('div');
    preview.className = 'media-preview album-preview';
    preview.innerHTML = `<div class="album-icon">📁</div>`;

    const info = document.createElement('div');
    info.className = 'media-info';
    const title = document.createElement('strong');
    title.textContent = album.label;
    const subtitle = document.createElement('small');
    subtitle.textContent = `${album.count} elementi`;
    info.appendChild(title);
    info.appendChild(subtitle);

    card.appendChild(preview);
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

function chunkFiles(files, size) {
    const result = [];
    for (let i = 0; i < files.length; i += size) {
        result.push(files.slice(i, i + size));
    }
    return result;
}

async function uploadBatch(files, batchIndex, batchCount, totalCount) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file, file.webkitRelativePath || file.name));

    const response = await fetch('/upload', { method: 'POST', body: formData });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Errore server ${response.status}: ${response.statusText} - ${text}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Errore durante il caricamento del batch.');
    }

    uploadStatus.textContent = `Batch ${batchIndex}/${batchCount} caricato, ${result.uploaded.length} file. Totale: ${totalCount}.`;
    return result;
}

async function uploadFiles(files) {
    if (!files.length) return;
    const chunkSize = 40;
    const batches = chunkFiles(files, chunkSize);
    uploadStatus.classList.add('active');

    try {
        let uploadedTotal = 0;
        for (let i = 0; i < batches.length; i += 1) {
            const batch = batches[i];
            uploadStatus.textContent = `Caricamento batch ${i + 1}/${batches.length} (${uploadedTotal}/${files.length})...`;
            const result = await uploadBatch(batch, i + 1, batches.length, files.length);
            uploadedTotal += result.uploaded.length;
        }

        uploadStatus.textContent = `Caricati ${uploadedTotal} file con successo.`;
        await loadMedia();
    } catch (error) {
        console.error('Upload failed:', error);
        uploadStatus.textContent = `Errore upload: ${error.message}`;
    } finally {
        setTimeout(() => {
            uploadStatus.textContent = '';
            uploadStatus.classList.remove('active');
        }, 4000);
    }
}

function openLightbox(index) {
    state.currentLightboxIndex = index;
    renderLightbox();
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
}

function renderLightbox() {
    const items = getVisibleMediaItems();
    if (!items.length) return;
    const item = items[state.currentLightboxIndex];
    lightboxContent.innerHTML = '';

    if (item.mime.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = `/media/${item.relative_path}`;
        img.alt = item.filename;
        lightboxContent.appendChild(img);
    } else if (item.mime.startsWith('video/')) {
        const video = document.createElement('video');
        video.controls = true;
        const src = document.createElement('source');
        src.src = `/media/${item.relative_path}`;
        src.type = item.mime;
        video.appendChild(src);
        lightboxContent.appendChild(video);
    } else {
        const audio = document.createElement('audio');
        audio.controls = true;
        const src = document.createElement('source');
        src.src = `/media/${item.relative_path}`;
        src.type = item.mime;
        audio.appendChild(src);
        lightboxContent.appendChild(audio);
    }

    lightboxTitle.textContent = item.filename;
    lightboxMeta.innerHTML = `
        <p><strong>Tipo:</strong> ${item.mime}</p>
        <p><strong>Cartella:</strong> ${item.folder || 'Radice'}</p>
        <p><strong>Dimensione:</strong> ${Math.round(item.size / 1024)} KB</p>
    `;
}

function navigateLightbox(direction) {
    const items = getVisibleMediaItems();
    if (!items.length) return;
    state.currentLightboxIndex = (state.currentLightboxIndex + direction + items.length) % items.length;
    renderLightbox();
}

function closeLightbox() {
    lightbox.classList.remove('visible');
    lightbox.setAttribute('aria-hidden', 'true');
}

document.addEventListener('DOMContentLoaded', loadMedia);
