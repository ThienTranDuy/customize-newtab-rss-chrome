// Bookmark functionality
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        // Try to get favicon directly from the website first
        const directFavicon = `${urlObj.origin}/favicon.ico`;
        return directFavicon;
    } catch (e) {
        return '';
    }
}

function createBookmarkElement(node) {
    if (node.url) {
        // Create bookmark item
        const bookmarkElement = document.createElement('a');
        bookmarkElement.href = node.url;
        bookmarkElement.className = 'bookmark-item';
        bookmarkElement.target = '';

        // Add favicon
        const favicon = document.createElement('img');
        favicon.className = 'bookmark-favicon';
        favicon.src = getFaviconUrl(node.url);
        favicon.onerror = () => {
            // If direct favicon fails, try Google's service
            const urlObj = new URL(node.url);
            favicon.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
            favicon.onerror = () => {
                favicon.style.display = 'none';
            };
        };
        bookmarkElement.appendChild(favicon);

        // Add title
        const title = document.createElement('span');
        title.textContent = node.title;
        bookmarkElement.appendChild(title);

        return bookmarkElement;
    } else if (node.children) {
        // Create folder
        const folderElement = document.createElement('div');
        folderElement.className = 'bookmark-folder';

        // Create folder header
        const folderHeader = document.createElement('div');
        folderHeader.className = 'bookmark-folder-header';
        folderHeader.textContent = node.title;
        folderElement.appendChild(folderHeader);

        // Create folder content
        const folderContent = document.createElement('div');
        folderContent.className = 'bookmark-folder-content';

        // Add children
        node.children.forEach(child => {
            if (child.url || (child.children && child.children.length > 0)) {
                const childElement = createBookmarkElement(child);
                folderContent.appendChild(childElement);
            }
        });

        // Add hover events
        let timeoutId;

        folderHeader.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
            const rect = folderHeader.getBoundingClientRect();
            const isSubfolder = folderElement.closest('.bookmark-folder-content') !== null;
            
            if (isSubfolder) {
                // For subfolders, show content on the right
                folderContent.style.top = `${rect.top}px`;
                folderContent.style.left = `${rect.right}px`;
            } else {
                // For main folders, show content below
                folderContent.style.top = `${rect.bottom}px`;
                folderContent.style.left = `${rect.left}px`;
            }
            folderContent.style.display = 'block';
        });

        folderElement.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                folderContent.style.display = 'none';
            }, 100); // Small delay to prevent flickering
        });

        folderContent.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
        });

        folderContent.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                folderContent.style.display = 'none';
            }, 100);
        });

        folderElement.appendChild(folderContent);
        return folderElement;
    }
    return null;
}

function displayBookmarkBar(nodes) {
    const bookmarksContainer = document.querySelector('.bookmarks-bar');
    bookmarksContainer.innerHTML = '';

    // Get bookmarks bar (first level)
    const bookmarksBar = nodes[0].children.find(node => node.title === 'Bookmarks Bar');
    if (bookmarksBar && bookmarksBar.children) {
        bookmarksBar.children.forEach(node => {
            if (node.url || (node.children && node.children.length > 0)) {
                const element = createBookmarkElement(node);
                if (element) {
                    bookmarksContainer.appendChild(element);
                }
            }
        });
    }
}

// Export functions
export {
    displayBookmarkBar
}; 