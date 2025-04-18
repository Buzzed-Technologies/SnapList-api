document.addEventListener('DOMContentLoaded', () => {
  // Try to get listing ID from URL query parameters first
  const urlParams = new URLSearchParams(window.location.search);
  let listingId = urlParams.get('id');
  
  // If not found in query, try path: /share/listing/:id
  if (!listingId) {
    const pathParts = window.location.pathname.split('/');
    listingId = pathParts[pathParts.length - 1];
  }
  
  if (!listingId) {
    showError('No listing ID provided');
    return;
  }
  
  // Fetch listing data
  fetchListingData(listingId);
});

async function fetchListingData(listingId) {
  try {
    const response = await fetch(`/share/data/${listingId}`);
    const data = await response.json();
    
    if (!data.success || !data.listing) {
      showError('Listing not found');
      return;
    }
    
    // Render listing data
    renderListing(data.listing, data.priceHistory);
    
    // Update metadata for social sharing
    updateMetadata(data.listing);
    
  } catch (error) {
    console.error('Error fetching listing data:', error);
    showError('Failed to load listing data');
  }
}

function renderListing(listing, priceHistory) {
  // Hide loading spinner, show listing container
  document.getElementById('loading').style.display = 'none';
  document.getElementById('listing-container').style.display = 'block';
  
  // Set basic listing info
  document.getElementById('listing-title').textContent = listing.title;
  document.getElementById('listing-price').textContent = `$${listing.price.toFixed(2)}`;
  document.getElementById('listing-description').textContent = listing.description;
  
  // Format date
  const createdDate = new Date(listing.created_at);
  document.getElementById('listing-date').textContent = formatDate(createdDate);
  
  // Set condition and original price
  document.getElementById('listing-condition').textContent = listing.condition || 'Not specified';
  document.getElementById('listing-original-price').textContent = `$${listing.original_price.toFixed(2)}`;
  
  // Set item details
  document.getElementById('detail-color').textContent = listing.color || 'Not specified';
  document.getElementById('detail-brand').textContent = listing.brand || 'Not specified';
  document.getElementById('detail-size').textContent = listing.size || 'Not specified';
  document.getElementById('detail-category').textContent = listing.category || 'Not specified';
  
  // Set status pill
  const statusPill = document.getElementById('listing-status');
  statusPill.textContent = capitalizeFirstLetter(listing.status);
  statusPill.classList.add(listing.status.toLowerCase());
  
  // Render images carousel
  renderImageCarousel(listing.image_urls);
  
  // Show marketplace links if available
  if (listing.ebay_listing_id) {
    const ebayLink = document.getElementById('ebay-link');
    // Use listing_url if available, otherwise construct from eBay ID
    ebayLink.href = listing.listing_url || `https://www.ebay.com/itm/${listing.ebay_listing_id}`;
    ebayLink.style.display = 'inline-flex';
  }
  
  if (listing.facebook_listing_id) {
    const fbLink = document.getElementById('facebook-link');
    // For Facebook, we don't always have a direct URL from the API
    // but we can construct one from the listing ID if available
    if (listing.facebook_listing_id) {
      fbLink.href = `https://www.facebook.com/marketplace/item/${listing.facebook_listing_id}`;
      fbLink.style.display = 'inline-flex';
    }
  }
}

function renderImageCarousel(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    // If no images, display a placeholder
    const carouselImages = document.getElementById('carousel-images');
    carouselImages.innerHTML = `
      <div class="carousel-image-container">
        <div class="no-image">No image available</div>
      </div>
    `;
    return;
  }
  
  const carouselImages = document.getElementById('carousel-images');
  const carouselDots = document.getElementById('carousel-dots');
  
  // Clear existing content
  carouselImages.innerHTML = '';
  carouselDots.innerHTML = '';
  
  // Add images to carousel
  imageUrls.forEach((url, index) => {
    // If it's already a complete URL, use it as is, otherwise prefix with Supabase
    const fullUrl = url.startsWith('http') 
      ? url 
      : `https://lsrdviupiuoztnccwdxk.supabase.co/storage/v1/object/public/snaplist-images/uploads/${url}`;
    
    const img = document.createElement('img');
    img.className = 'carousel-image';
    img.src = fullUrl;
    img.alt = `Listing image ${index + 1}`;
    carouselImages.appendChild(img);
    
    // Add dot for this image
    const dot = document.createElement('div');
    dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
    dot.dataset.index = index;
    dot.addEventListener('click', () => {
      setActiveImage(index);
    });
    carouselDots.appendChild(dot);
  });
  
  // If more than one image, setup carousel functionality
  if (imageUrls.length > 1) {
    setupCarousel();
  }
}

function setupCarousel() {
  const carouselImages = document.getElementById('carousel-images');
  const dots = document.querySelectorAll('.carousel-dot');
  let currentIndex = 0;
  
  // Set initial width for the carousel
  const imageWidth = carouselImages.offsetWidth;
  carouselImages.style.width = `${imageWidth * dots.length}px`;
  
  // Function to change active image
  window.setActiveImage = (index) => {
    // Update current index
    currentIndex = index;
    
    // Move carousel
    carouselImages.style.transform = `translateX(-${index * 100}%)`;
    
    // Update active dot
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  };
  
  // Auto-advance carousel every 5 seconds
  setInterval(() => {
    currentIndex = (currentIndex + 1) % dots.length;
    setActiveImage(currentIndex);
  }, 5000);
}

function updateMetadata(listing) {
  // Set page title
  document.title = `${listing.title} - SnapList`;
  
  // Update Open Graph meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  
  ogTitle.content = `${listing.title} - SnapList`;
  ogDescription.content = listing.description.substring(0, 200) + (listing.description.length > 200 ? '...' : '');
  
  // Set image if available
  if (listing.image_urls && listing.image_urls.length > 0) {
    const imageUrl = listing.image_urls[0];
    // If it's already a complete URL, use it as is, otherwise prefix with Supabase
    const fullUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `https://lsrdviupiuoztnccwdxk.supabase.co/storage/v1/object/public/snaplist-images/uploads/${imageUrl}`;
    
    ogImage.content = fullUrl;
  }
  
  ogUrl.content = window.location.href;
}

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  const errorElement = document.getElementById('error-message');
  errorElement.style.display = 'block';
  errorElement.querySelector('p').textContent = message || 'Sorry, we couldn\'t load this listing.';
}

// Helper functions
function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: '2-digit' 
  }).format(date);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
} 