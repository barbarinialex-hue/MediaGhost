// Carica i media dall'API
let allMedia = [];
let filteredMedia = [];
let currentIndex = 0;
const batchSize = 20;

async function loadMedia() {
    const response = await fetch('/api/media');
    allMedia = await response.json();
    filteredMedia = allMedia;
    displayMedia();
}

function displayMedia() {
    const gallery = document.getElementById('gallery');
    const nextBatch = filteredMedia.slice(currentIndex, currentIndex + batchSize);
    nextBatch.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-item';
        if (item.mime.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = `/thumb/${item.filename}`;
            img.onclick = () => openLightbox(item);
            div.appendChild(img);
        } else if (item.mime.startsWith('video/')) {
            const vid = document.createElement('video');
            vid.src = `/media/${item.filename}`;
            vid.onclick = () => openLightbox(item);
            div.appendChild(vid);
        }
        gallery.appendChild(div);
    });
    currentIndex += batchSize;
}

// Infinite scroll
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && currentIndex < filteredMedia.length) {
        displayMedia();
    }
});
observer.observe(document.getElementById('load-more'));

// Filtri
document.getElementById('filter-type').addEventListener('change', filterMedia);
document.getElementById('filter-date').addEventListener('change', filterMedia);

function filterMedia() {
    const type = document.getElementById('filter-type').value;
    const date = document.getElementById('filter-date').value;
    filteredMedia = allMedia.filter(item => {
        if (type && !item.mime.startsWith(type)) return false;
        // Per data, supponiamo filename con data, ma per ora skip
        return true;
    });
    currentIndex = 0;
    document.getElementById('gallery').innerHTML = '';
    displayMedia();
}

// Lightbox semplice
function openLightbox(item) {
    const modal = document.getElementById('lightbox');
    const content = document.getElementById('lightbox-content');
    if (item.mime.startsWith('image/')) {
        content.innerHTML = `<img src="/media/${item.filename}" style="max-width:100%; max-height:100%;">`;
    } else if (item.mime.startsWith('video/')) {
        content.innerHTML = `<video controls src="/media/${item.filename}"></video>`;
    }
    modal.style.display = 'block';
}

document.getElementById('lightbox').onclick = () => {
    document.getElementById('lightbox').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', loadMedia);