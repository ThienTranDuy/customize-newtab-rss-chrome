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
    let allArticles = [];
    let pinnedFeeds = new Set();
    let currentPage = 1;
    const articlesPerPage = 50;
    let isLoading = false;

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
        if (!isLoading) {
            loadMoreArticles();
        }
    });

    // Scroll load more
    container.addEventListener('scroll', () => {
        if (isLoading) return;

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
            loadAllFeeds(result.rssFeeds);
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
                        allArticles = [];
                        currentPage = 1;
                        loadAllFeeds(feeds);
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
                allArticles = [];
                currentPage = 1;
                loadAllFeeds(feeds);
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
                        allArticles = [];
                        currentPage = 1;
                        loadAllFeeds(feeds);
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
                        allArticles = [];
                        currentPage = 1;
                        loadAllFeeds(feeds);
                    });
                });
            });
        });
    }

    async function loadAllFeeds(feeds) {
        const loadingElement = document.getElementById('loading');
        const errorElement = document.querySelector('.error');

        if (!loadingElement || !errorElement) {
            console.error('Required elements not found');
            return;
        }

        try {
            loadingElement.style.display = 'block';
            errorElement.style.display = 'none';

            // Reset pagination
            currentPage = 1;
            allArticles = [];

            // Sort feeds by pinned status
            const sortedFeeds = [...feeds].sort((a, b) => {
                const aPinned = pinnedFeeds.has(a.url);
                const bPinned = pinnedFeeds.has(b.url);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                return 0;
            });

            // Fetch all feeds in parallel
            const feedPromises = sortedFeeds.map(feed => fetchAndParseFeed(feed.url, feed.name, feed.code, feed.limit));
            const results = await Promise.allSettled(feedPromises);

            // Collect all articles
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const feed = sortedFeeds[index];
                    const articles = result.value.map(article => ({
                        ...article,
                        isFromPinnedFeed: pinnedFeeds.has(feed.url)
                    }));
                    allArticles = allArticles.concat(articles);
                }
            });

            // Remove duplicate articles based on link
            allArticles = allArticles.filter((article, index, self) =>
                index === self.findIndex((a) => a.link === article.link)
            );

            // Sort all articles by date
            allArticles.sort((a, b) => {
                // First sort by pinned feed status
                if (a.isFromPinnedFeed && !b.isFromPinnedFeed) return -1;
                if (!a.isFromPinnedFeed && b.isFromPinnedFeed) return 1;
                // Then sort by date
                return b.pubDate - a.pubDate;
            });

            console.log('Total articles:', allArticles.length); // Debug log

            // Display first page of articles
            displayArticles();

        } catch (error) {
            console.error('Error loading feeds:', error);
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        } finally {
            loadingElement.style.display = 'none';
        }
    }

    function loadMoreArticles() {
        if (isLoading || currentPage * articlesPerPage >= allArticles.length) return;

        isLoading = true;
        loadMoreElement.classList.add('loading');
        loadMoreElement.textContent = 'Loading...';

        // Simulate loading delay
        setTimeout(() => {
            currentPage++;
            displayArticles();
            isLoading = false;
            loadMoreElement.classList.remove('loading');
            loadMoreElement.textContent = 'Load More';
            
            // Hide button if no more articles
            if (currentPage * articlesPerPage >= allArticles.length) {
                loadMoreElement.style.display = 'none';
            }
        }, 300);
    }

    function displayArticles() {
        const articlesGrid = document.querySelector('.articles-grid');
        if (!articlesGrid) return;

        // Calculate start and end indices for current page
        const start = (currentPage - 1) * articlesPerPage;
        const end = Math.min(currentPage * articlesPerPage, allArticles.length);
        const currentArticles = allArticles.slice(start, end);

        // Clear existing articles if it's the first page
        if (currentPage === 1) {
            articlesGrid.innerHTML = '';
        }

        // Add new articles
        currentArticles.forEach(article => {
            const articleCard = createArticleCard(article);
            articlesGrid.appendChild(articleCard);
        });

        // Show/hide load more button
        if (loadMoreElement) {
            const hasMoreArticles = end < allArticles.length;
            loadMoreElement.style.display = hasMoreArticles ? 'flex' : 'none';
            
            // Update button text to show remaining articles
            if (hasMoreArticles) {
                const remainingArticles = allArticles.length - end;
                loadMoreElement.textContent = `Load More (${remainingArticles} articles left)`;
            }
        }
    }

    function createArticleCard(article) {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';
        if (article.code) {
            articleCard.setAttribute('data-code', article.code);
        }
        if (article.isFromPinnedFeed) {
            articleCard.classList.add('pinned-feed-article');
        }

        articleCard.innerHTML = `
            ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="article-image">` : ''}
            <div class="article-content">
                <h2 class="article-title">
                    <a href="${article.link}" target="_blank">${article.title}</a>
                </h2>
                <p class="article-description">${article.description}</p>
                <div class="article-meta">
                    <span>${article.author}</span>
                    <span>${article.pubDate.toLocaleDateString()}</span>
                    <span class="article-source">${article.source}</span>
                </div>
            </div>
        `;

        return articleCard;
    }

    async function fetchAndParseFeed(rssUrl, feedName, feedCode, feedLimit = 20) {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchRSS', url: rssUrl }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (!response.success) {
            throw new Error(response.error || 'Không thể tải RSS feed');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.data, 'text/xml');

        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Không thể đọc nội dung RSS feed. Vui lòng kiểm tra lại URL.');
        }

        const items = xmlDoc.getElementsByTagName('item');
        if (!items || items.length === 0) {
            throw new Error('Không tìm thấy bài viết nào trong RSS feed.');
        }

        const articles = [];
        const limit = Math.min(feedLimit, items.length);
        
        for (let i = 0; i < limit; i++) {
            const item = items[i];
            const titleElement = item.querySelector('title');
            const linkElement = item.querySelector('link');
            const descriptionElement = item.querySelector('description');
            const pubDateElement = item.querySelector('pubDate');
            const authorElement = item.querySelector('dc\\:creator') || item.querySelector('creator');
            const imageElement = item.querySelector('media\\:content') || item.querySelector('enclosure');

            let imageUrl = '';
            if (imageElement) {
                imageUrl = imageElement.getAttribute('url') || '';
            } else if (descriptionElement) {
                const imgMatch = descriptionElement.textContent.match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch) {
                    imageUrl = imgMatch[1];
                }
            }

            const title = titleElement?.textContent?.trim() || 'Không có tiêu đề';
            const link = linkElement?.textContent?.trim() || '#';
            const description = descriptionElement?.textContent?.trim() || 'Không có mô tả';
            const pubDate = pubDateElement?.textContent?.trim() || 'Không có ngày';
            const author = authorElement?.textContent?.trim() || 'Không có tác giả';

            articles.push({
                title,
                link,
                description,
                pubDate: new Date(pubDate),
                author,
                imageUrl,
                source: feedName || new URL(rssUrl).hostname,
                code: feedCode || ''
            });
        }

        return articles;
    }

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
            bookmarkElement.target = '_blank';

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
}); 