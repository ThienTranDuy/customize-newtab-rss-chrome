import { displayBookmarkBar } from './bookmark.js';
import { loadAllFeeds, loadMoreArticles } from './article.js';

document.addEventListener('DOMContentLoaded', () => {
    const rssUrlInput = document.getElementById('rssUrl');
    const rssNameInput = document.getElementById('rssName');
    const rssCodeInput = document.getElementById('rssCode');
    const rssLimitInput = document.getElementById('rssLimit');
    const saveButton = document.getElementById('saveUrl');
    const manageFeedsBtn = document.getElementById('manageFeedsBtn');
    const rssManager = document.getElementById('rssManager');
    const loadingElement = document.getElementById('loading');
    const loadMoreElement = document.getElementById('loadMore');
    const bookmarksContainer = document.getElementById('bookmarks');
    const rssFeedsContainer = document.getElementById('rssFeeds');
    const container = document.querySelector('.container');

    // Store all articles and pagination
    let pinnedFeeds = new Set();

    // Load pinned feeds from storage
    chrome.storage.sync.get(['pinnedFeeds'], (result) => {
        if (result.pinnedFeeds) {
            pinnedFeeds = new Set(result.pinnedFeeds);
        }
    });

    // Toggle RSS Manager
    manageFeedsBtn.addEventListener('click', () => {
        rssManager.style.display = rssManager.style.display === 'none' ? 'block' : 'none';
    });

    // Load More button click handler
    loadMoreElement.addEventListener('click', () => {
        loadMoreArticles();
    });

    // Scroll load more
    container.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
        
        if (scrollPercentage > 0.8) { // Load more when user scrolls to 80% of the container
            loadMoreArticles();
        }
    });

    // Load saved RSS feeds
    chrome.storage.sync.get(['rssFeeds'], (result) => {
        if (result.rssFeeds && result.rssFeeds.length > 0) {
            displayRssFeeds(result.rssFeeds);
            // Load all feeds
            loadAllFeeds(result.rssFeeds, pinnedFeeds);
        }
    });

    // Load bookmarks
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        displayBookmarkBar(bookmarkTreeNodes);
    });

    // Save RSS URL
    saveButton.addEventListener('click', () => {
        const rssUrl = rssUrlInput.value.trim();
        const rssName = rssNameInput.value.trim();
        const rssCode = rssCodeInput.value.trim();
        const rssLimit = parseInt(rssLimitInput.value) || 20;
        
        if (rssUrl) {
            chrome.storage.sync.get(['rssFeeds'], (result) => {
                const feeds = result.rssFeeds || [];
                // Check if feed already exists
                if (!feeds.some(feed => feed.url === rssUrl)) {
                    feeds.push({
                        url: rssUrl,
                        name: rssName || new URL(rssUrl).hostname,
                        code: rssCode || '',
                        limit: rssLimit
                    });
                    chrome.storage.sync.set({ rssFeeds: feeds }, () => {
                        displayRssFeeds(feeds);
                        // Clear articles and reload all feeds
                        loadAllFeeds(feeds, pinnedFeeds);
                        rssUrlInput.value = '';
                        rssNameInput.value = '';
                        rssCodeInput.value = '';
                        rssLimitInput.value = '20';
                    });
                }
            });
        }
    });

    function displayRssFeeds(feeds) {
        rssFeedsContainer.innerHTML = '';

        // Create sections for pinned and normal feeds
        const pinnedSection = document.createElement('div');
        pinnedSection.className = 'feeds-section';
        pinnedSection.innerHTML = `
            <div class="section-header pinned-header">
                <span>📌 Pinned Feeds</span>
            </div>
            <div class="rss-list pinned-list"></div>
        `;

        const normalSection = document.createElement('div');
        normalSection.className = 'feeds-section';
        normalSection.innerHTML = `
            <div class="section-header">
                <span>📋 Normal Feeds</span>
            </div>
            <div class="rss-list normal-list"></div>
        `;

        rssFeedsContainer.appendChild(pinnedSection);
        rssFeedsContainer.appendChild(normalSection);

        const pinnedList = pinnedSection.querySelector('.rss-list');
        const normalList = normalSection.querySelector('.rss-list');

        feeds.forEach(feed => {
            const feedElement = document.createElement('div');
            feedElement.className = 'rss-feed-item';
            const isPinned = pinnedFeeds.has(feed.url);
            if (isPinned) {
                feedElement.classList.add('pinned');
            }
            
            feedElement.innerHTML = `
                <div class="rss-info">
                    <input type="text" class="feed-name" value="${feed.name}" placeholder="Feed Name">
                    <input type="text" class="feed-url" value="${feed.url}" placeholder="Feed URL">
                    <input type="text" class="feed-code" value="${feed.code || ''}" placeholder="Feed Code">
                    <input type="number" class="feed-limit" value="${feed.limit || 20}" min="1" max="100">
                </div>
                <div class="rss-meta">
                    <button class="pin-feed ${isPinned ? 'active' : ''}" data-url="${feed.url}" title="${isPinned ? 'Unpin feed' : 'Pin feed'}">
                        ${isPinned ? '📌' : '📍'}
                    </button>
                    <button class="save-feed" data-url="${feed.url}">💾</button>
                    <button class="remove-feed" data-url="${feed.url}">×</button>
                </div>
            `;

            if (isPinned) {
                pinnedList.appendChild(feedElement);
            } else {
                normalList.appendChild(feedElement);
            }
        });

        // Add event listeners
        addFeedEventListeners(feeds);
    }

    function addFeedEventListeners(feeds) {
        // Pin event listeners
        document.querySelectorAll('.pin-feed').forEach(button => {
            button.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                const feedItem = e.target.closest('.rss-feed-item');
                
                if (pinnedFeeds.has(url)) {
                    pinnedFeeds.delete(url);
                    feedItem.classList.remove('pinned');
                    e.target.classList.remove('active');
                    e.target.textContent = '📍';
                    e.target.title = 'Pin feed';
                    // Move to normal list
                    document.querySelector('.normal-list').appendChild(feedItem);
                } else {
                    pinnedFeeds.add(url);
                    feedItem.classList.add('pinned');
                    e.target.classList.add('active');
                    e.target.textContent = '📌';
                    e.target.title = 'Unpin feed';
                    // Move to pinned list
                    document.querySelector('.pinned-list').appendChild(feedItem);
                }
                
                chrome.storage.sync.set({ 
                    pinnedFeeds: Array.from(pinnedFeeds) 
                });

                // Reload articles
                loadAllFeeds(feeds, pinnedFeeds);
            });
        });

        // Save event listeners
        document.querySelectorAll('.save-feed').forEach(button => {
            button.addEventListener('click', (e) => {
                const feedItem = e.target.closest('.rss-feed-item');
                const oldUrl = e.target.dataset.url;
                const newName = feedItem.querySelector('.feed-name').value.trim();
                const newUrl = feedItem.querySelector('.feed-url').value.trim();
                const newCode = feedItem.querySelector('.feed-code').value.trim();
                const newLimit = parseInt(feedItem.querySelector('.feed-limit').value) || 20;

                chrome.storage.sync.get(['rssFeeds'], (result) => {
                    const feeds = result.rssFeeds.map(feed => {
                        if (feed.url === oldUrl) {
                            return {
                                ...feed,
                                name: newName,
                                url: newUrl,
                                code: newCode,
                                limit: newLimit
                            };
                        }
                        return feed;
                    });

                    chrome.storage.sync.set({ rssFeeds: feeds }, () => {
                        displayRssFeeds(feeds);
                        loadAllFeeds(feeds, pinnedFeeds);
                    });
                });
            });
        });

        // Remove event listeners
        document.querySelectorAll('.remove-feed').forEach(button => {
            button.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                chrome.storage.sync.get(['rssFeeds'], (result) => {
                    const feeds = result.rssFeeds.filter(feed => feed.url !== url);
                    pinnedFeeds.delete(url);
                    chrome.storage.sync.set({ 
                        rssFeeds: feeds,
                        pinnedFeeds: Array.from(pinnedFeeds)
                    }, () => {
                        displayRssFeeds(feeds);
                        loadAllFeeds(feeds, pinnedFeeds);
                    });
                });
            });
        });
    }
}); 