// Article functionality
let allArticles = [];
let currentPage = 1;
const articlesPerPage = 50;
let isLoading = false;
let existingTitles = new Set();

// Function to check if title should be filtered out
function shouldFilterTitle(title) {
    // Check for phone numbers (various formats)
    const phoneRegex = /(^|\s)(\+?\d{1,3}[\s-]?)?(0\d{8,12}|\d{8,12})(\s|$)/;
    const phoneWithDashRegex = /(^|\s)\+?\d{1,3}–\d{8,12}(\s|$)/;
    if (phoneRegex.test(title) || phoneWithDashRegex.test(title)) {
        return true;
    }

    // Check for Arabic, Korean, Japanese, Chinese characters
    const specialCharsRegex = /[\u0600-\u06FF\uAC00-\uD7AF\u3040-\u30FF\u4E00-\u9FFF]/;
    if (specialCharsRegex.test(title)) {
        return true;
    }

    return false;
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
        
        // Skip if title already exists or should be filtered
        if (existingTitles.has(title) || shouldFilterTitle(title)) {
            continue;
        }
        
        // Add title to existing titles set
        existingTitles.add(title);
        
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
        <div class="article-label">
            <span class="article-label-text">${article.code}</span>
        </div>
    `;

    return articleCard;
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
    const loadMoreElement = document.getElementById('loadMore');
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

function loadMoreArticles() {
    if (isLoading || currentPage * articlesPerPage >= allArticles.length) return;

    isLoading = true;
    const loadMoreElement = document.getElementById('loadMore');
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

async function loadAllFeeds(feeds, pinnedFeeds) {
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

// Export functions
export {
    loadAllFeeds,
    loadMoreArticles,
    displayArticles
}; 