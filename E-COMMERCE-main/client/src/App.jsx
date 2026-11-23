import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ShoppingBag, Heart, ArrowRight, Star, Plus, Minus, X, Menu,
  SlidersHorizontal, Check, Package, Truck, ShieldCheck, Headphones,
  ChevronDown, UserRound, LogOut, LoaderCircle, LockKeyhole, RefreshCw,
  CalendarDays, MapPin, DollarSign, TrendingUp, Clock3, Save, Moon, Sun,
  Tag, ImagePlus,
} from 'lucide-react';
import placeholderImage from './images/placeholder.svg';
import { apiRequest, API_BASE_URL } from './lib/api.js';

const localImages = import.meta.glob('./images/*.{png,jpg,jpeg,jfif,webp,avif,svg}', {
  eager: true,
  import: 'default',
});

function localImage(filename) {
  let imageName = String(filename || '').split(/[\\/]/).pop();
  try { imageName = decodeURIComponent(imageName); } catch { /* keep the original filename */ }
  const wanted = imageName.replace(/\.[^.]+$/, '').toLowerCase();
  const match = Object.entries(localImages).find(([path]) => {
    const imageName = path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
    return imageName === wanted;
  });
  return match?.[1] || placeholderImage;
}

function resolveProductImage(image, name) {
  if (typeof image === 'string' && /^(https?:\/\/|data:|\/(?:assets|src)\/)/i.test(image)) return image;
  if (typeof image === 'string' && image.startsWith('/uploads/')) return `${API_BASE_URL.replace(/\/api\/?$/, '')}${image}`;
  const candidate = (image || name || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  return localImage(candidate);
}

const categories = ['All', 'Fashion', 'Accessories', 'Tech', 'Home'];
const appPageNames = new Set(['landing', 'shop', 'new-arrivals', 'fashion', 'accessories', 'tech', 'living', 'vouchers', 'story', 'orders', 'wishlist', 'settings', 'admin']);
function pageFromHash() {
  const route = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return appPageNames.has(route) ? route : 'landing';
}
const orderStatusSteps = ['pending', 'processing', 'shipped', 'delivered'];
const orderStatusLabel = (status) => ({
  pending: 'Order placed',
  processing: 'Preparing',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}[status] || status);

function readSavedState(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}
function readSavedValue(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeSavedValue(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* storage may be unavailable */ }
}
function removeSavedValue(key) {
  try { window.localStorage.removeItem(key); } catch { /* storage may be unavailable */ }
}
const peso = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(n) || 0);
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const reviewKey = (orderId, productId) => `${orderId}:${productId}`;
const emptyCouponForm = () => ({ code: '', type: 'percentage', value: '10', minimumSubtotal: '0', maxDiscount: '', usageLimit: '', startsAt: '', expiresAt: '', active: true });
const profileFormFromUser = (account = {}) => ({
  firstName: account?.firstName || '', lastName: account?.lastName || '', email: account?.email || '', phone: account?.phone || '',
  addressLine1: account?.shippingAddress?.addressLine1 || '', addressLine2: account?.shippingAddress?.addressLine2 || '',
  city: account?.shippingAddress?.city || '', province: account?.shippingAddress?.province || '',
  postalCode: account?.shippingAddress?.postalCode || '', country: account?.shippingAddress?.country || 'Philippines',
});
const checkoutAddressFromUser = (account = {}) => ({
  addressLine1: account?.shippingAddress?.addressLine1 || '', addressLine2: account?.shippingAddress?.addressLine2 || '',
  city: account?.shippingAddress?.city || '', province: account?.shippingAddress?.province || '',
  postalCode: account?.shippingAddress?.postalCode || '', country: account?.shippingAddress?.country || 'Philippines',
});
const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function cartMapFromResponse(responseData) {
  const cart = {};
  for (const item of responseData?.items || []) {
    const productId = item.productId && typeof item.productId === 'object' ? item.productId._id : item.productId;
    if (productId) cart[String(productId)] = Number(item.quantity) || 1;
  }
  return cart;
}

function mergeCartMaps(first, second, validProductIds) {
  const result = { ...first };
  for (const [id, quantity] of Object.entries(second || {})) {
    if (validProductIds.has(String(id)) && isObjectId(id)) result[id] = (result[id] || 0) + Number(quantity || 0);
  }
  return result;
}

function App() {
  const [page, setPage] = useState(() => pageFromHash());
  const [products, setProducts] = useState([]);
  const [catalogSource, setCatalogSource] = useState('loading');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [shopProductsPage, setShopProductsPage] = useState(1);
  const [cart, setCart] = useState(() => readSavedState('skyshop-cart', {}));
  const [wishlist, setWishlist] = useState(() => readSavedState('skyshop-wishlist', []));
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailReviews, setDetailReviews] = useState([]);
  const detailRequestRef = useRef(0);
  const [ordersOpen, setOrdersOpen] = useState(() => pageFromHash() === 'orders');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [myReviews, setMyReviews] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [savingOrderId, setSavingOrderId] = useState('');
  const [cancellingOrderId, setCancellingOrderId] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminStatusDrafts, setAdminStatusDrafts] = useState({});
  const [adminProductQuery, setAdminProductQuery] = useState('');
  const [adminProductsPage, setAdminProductsPage] = useState(1);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState('');
  const [adminUsersQuery, setAdminUsersQuery] = useState('');
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const [adminUsersPagination, setAdminUsersPagination] = useState({ total: 0, pages: 1, limit: 20 });
  const [adminSection, setAdminSection] = useState('dashboard');
  const [editingProductId, setEditingProductId] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState('');
  const productImageInputRef = useRef(null);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [availableCouponsLoading, setAvailableCouponsLoading] = useState(false);
  const [availableCouponsError, setAvailableCouponsError] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState('');
  const [couponForm, setCouponForm] = useState(emptyCouponForm);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'Fashion', description: '', price: '', oldPrice: '', stock: '', rating: '4.8', reviews: '0', tag: '', image: '', bg: '#e2efff' });
  useEffect(() => {
    if (!productImageFile) { setProductImagePreview(''); return undefined; }
    const previewUrl = URL.createObjectURL(productImageFile);
    setProductImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [productImageFile]);
  useEffect(() => {
    if (!detailProduct) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeProductDetails();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailProduct]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const headerSearchInputRef = useRef(null);
  const [sort, setSort] = useState('featured');
  const [theme, setTheme] = useState(() => readSavedState('skyshop-theme', 'light') === 'dark' ? 'dark' : 'light');
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState(() => readSavedValue('skyshop-token'));
  const [user, setUser] = useState(() => readSavedState('skyshop-user', null));
  const isAdmin = user?.role === 'admin';
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [categoriesMenuOpen, setCategoriesMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState(null);
  const profileMenuRef = useRef(null);
  const categoriesMenuRef = useRef(null);
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [accountSection, setAccountSection] = useState('profile');
  const [profileForm, setProfileForm] = useState(() => profileFormFromUser(readSavedState('skyshop-user', null)));
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [instantCheckoutItems, setInstantCheckoutItems] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '',
    province: '', postalCode: '', country: 'Philippines', paymentMethod: 'cash_on_delivery', notes: '',
  });
  const pendingGuestCart = useRef(null);
  const noticeTimer = useRef(null);

  const showNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem('skyshop-theme', theme); } catch { /* storage may be unavailable */ }
  }, [theme]);

  useEffect(() => {
    if (accountOpen && user) setProfileForm(profileFormFromUser(user));
  }, [accountOpen, user]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') setProfileMenuOpen(false);
      if (event.type === 'pointerdown' && !profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!categoriesMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') setCategoriesMenuOpen(false);
      if (event.type === 'pointerdown' && !categoriesMenuRef.current?.contains(event.target)) setCategoriesMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [categoriesMenuOpen]);

  useEffect(() => {
    if (!cancelOrderTarget) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && cancellingOrderId !== cancelOrderTarget._id) setCancelOrderTarget(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [cancelOrderTarget, cancellingOrderId]);

  useEffect(() => {
    const syncPage = () => {
      const nextPage = pageFromHash();
      setPage(nextPage);
      setOrdersOpen(nextPage === 'orders');
      setCategory(({ fashion: 'Fashion', accessories: 'Accessories', tech: 'Tech', living: 'Home' })[nextPage] || 'All');
      setShopProductsPage(1);
    };
    window.addEventListener('hashchange', syncPage);
    window.addEventListener('popstate', syncPage);
    return () => {
      window.removeEventListener('hashchange', syncPage);
      window.removeEventListener('popstate', syncPage);
    };
  }, []);

  useEffect(() => {
    if (isAdmin && page !== 'admin') navigatePage('admin');
  }, [isAdmin, page]);

  const reloadProducts = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const result = await apiRequest('/products?limit=100&sort=featured');
      const apiProducts = (result.data || []).map((product) => ({
        ...product,
        sourceImage: product.image || '',
        image: resolveProductImage(product.image, product.name),
      }));
      setProducts(apiProducts);
      setCatalogSource('api');
      // Drop stale guest cart entries after switching from the original demo IDs to MongoDB IDs.
      if (!readSavedValue('skyshop-token')) {
        const validIds = new Set(apiProducts.map((product) => String(product._id)));
        setCart((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => validIds.has(String(id)))));
      }
    } catch (error) {
      setProducts([]);
      setCatalogSource('demo');
      setCatalogError(error.message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const result = await apiRequest('/orders?limit=50');
      setOrders(result.data || []);
      try {
        const reviewResult = await apiRequest('/reviews/mine');
        setMyReviews(Object.fromEntries((reviewResult.data || []).map((review) => [reviewKey(review.orderId, review.productId), review])));
      } catch {
        setMyReviews({});
      }
    } catch (error) {
      setOrdersError(error.message || 'Could not load your orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadAdminOrders = useCallback(async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const result = await apiRequest('/orders?limit=100');
      setAdminOrders(result.data || []);
    } catch (error) {
      setAdminError(error.message || 'Could not load order data.');
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const loadAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    setAdminUsersError('');
    try {
      const query = new URLSearchParams({ page: String(adminUsersPage), limit: '20', search: adminUsersQuery.trim() });
      const result = await apiRequest(`/users?${query.toString()}`);
      setAdminUsers(result.data || []);
      setAdminUsersPagination(result.pagination || { total: 0, pages: 1, limit: 20 });
    } catch (error) {
      setAdminUsersError(error.message || 'Could not load registered users.');
    } finally {
      setAdminUsersLoading(false);
    }
  }, [adminUsersPage, adminUsersQuery]);

  const loadCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const result = await apiRequest('/coupons');
      setCoupons(result.data || []);
    } catch (error) {
      showNotice(error.message || 'Could not load coupons.');
    } finally {
      setCouponsLoading(false);
    }
  }, [showNotice]);

  const loadAvailableCoupons = useCallback(async () => {
    setAvailableCouponsLoading(true);
    setAvailableCouponsError('');
    try {
      const result = await apiRequest('/coupons/available');
      setAvailableCoupons(result.data || []);
    } catch (error) {
      setAvailableCouponsError(error.message || 'Could not load vouchers right now.');
    } finally {
      setAvailableCouponsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ordersOpen && token) loadOrders();
  }, [ordersOpen, token, loadOrders]);

  useEffect(() => {
    if (page === 'admin' && token && user?.role === 'admin') loadAdminOrders();
  }, [page, token, user?.role, loadAdminOrders]);

  useEffect(() => {
    if (page === 'admin' && adminSection === 'coupons' && token && user?.role === 'admin') loadCoupons();
  }, [page, adminSection, token, user?.role, loadCoupons]);

  useEffect(() => {
    if (page !== 'admin' || adminSection !== 'users' || !token || user?.role !== 'admin') return undefined;
    const timer = window.setTimeout(loadAdminUsers, adminUsersQuery ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [page, adminSection, token, user?.role, loadAdminUsers, adminUsersQuery]);

  useEffect(() => {
    if (page === 'vouchers') loadAvailableCoupons();
  }, [page, loadAvailableCoupons]);

  useEffect(() => { reloadProducts(); }, [reloadProducts]);

  // Verify any saved login after the app starts.
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    apiRequest('/auth/me').then((result) => {
      if (!active) return;
      setUser(result.data);
      writeSavedValue('skyshop-user', JSON.stringify(result.data));
    }).catch(() => {
      if (!active) return;
      removeSavedValue('skyshop-token');
      removeSavedValue('skyshop-user');
      setToken('');
      setUser(null);
    });
    return () => { active = false; };
    // Initial session validation only; the endpoint is called again after a new login via the cart sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a signed-in user's cart in MongoDB. On first login, merge valid guest items into their server cart.
  const syncRemoteCart = useCallback(async () => {
    try {
      const result = await apiRequest('/carts/me');
      let serverCart = cartMapFromResponse(result.data);
      const guestCart = pendingGuestCart.current;
      pendingGuestCart.current = null;
      if (guestCart && Object.keys(guestCart).length) {
        const ids = new Set(products.map((product) => String(product._id)));
        const merged = mergeCartMaps(serverCart, guestCart, ids);
        if (Object.keys(merged).length) {
          const saved = await apiRequest('/carts/me', {
            method: 'PUT',
            body: { items: Object.entries(merged).map(([productId, quantity]) => ({ productId, quantity })) },
          });
          serverCart = cartMapFromResponse(saved.data);
        }
      }
      setCart(serverCart);
    } catch (error) {
      if (error.status === 401) {
        removeSavedValue('skyshop-token');
        removeSavedValue('skyshop-user');
        setToken('');
        setUser(null);
        setCart(readSavedState('skyshop-cart', {}));
      }
      showNotice(error.message || 'Could not load your saved cart.');
    }
  }, [products, showNotice]);

  useEffect(() => {
    if (token && catalogSource === 'api') syncRemoteCart();
  }, [token, catalogSource, syncRemoteCart]);

  // If a saved token is rejected, reconcile the local guest cart against the live catalogue.
  useEffect(() => {
    if (token || catalogSource !== 'api') return;
    const validIds = new Set(products.map((product) => String(product._id)));
    setCart((previous) => {
      const next = Object.fromEntries(Object.entries(previous).filter(([id]) => validIds.has(String(id))));
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [token, catalogSource, products]);

  // Guest carts stay in localStorage. Signed-in carts are stored in MongoDB instead.
  useEffect(() => {
    if (!token) {
      try { window.localStorage.setItem('skyshop-cart', JSON.stringify(cart)); } catch { /* storage may be unavailable */ }
    }
  }, [cart, token]);
  useEffect(() => {
    try { window.localStorage.setItem('skyshop-wishlist', JSON.stringify(wishlist)); } catch { /* storage may be unavailable */ }
  }, [wishlist]);

  const visibleProducts = useMemo(() => {
    let list = products.filter((product) =>
      (category === 'All' || product.category === category) &&
      product.name.toLowerCase().includes(search.toLowerCase())
    );
    if (page === 'new-arrivals') list = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    else if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'rating') list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
  }, [products, category, search, sort, page]);
  const shopProductsPageSize = 12;
  const shopProductsPageCount = Math.max(1, Math.ceil(visibleProducts.length / shopProductsPageSize));
  const currentShopProductsPage = Math.min(shopProductsPage, shopProductsPageCount);
  const paginatedProducts = visibleProducts.slice((currentShopProductsPage - 1) * shopProductsPageSize, currentShopProductsPage * shopProductsPageSize);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (ordersFilter === 'active') return !['delivered', 'cancelled'].includes(order.status);
    if (ordersFilter === 'delivered' || ordersFilter === 'cancelled') return order.status === ordersFilter;
    return true;
  }), [orders, ordersFilter]);

  const adminFilteredOrders = useMemo(() => adminOrders.filter((order) => (
    adminStatusFilter === 'all' || order.status === adminStatusFilter
  )), [adminOrders, adminStatusFilter]);
  const adminFilteredProducts = useMemo(() => products.filter((product) => {
    const query = adminProductQuery.trim().toLowerCase();
    return !query || [product.name, product.category, product.description].some((value) => String(value || '').toLowerCase().includes(query));
  }), [products, adminProductQuery]);
  const adminProductsPageSize = 10;
  const adminProductsPageCount = Math.max(1, Math.ceil(adminFilteredProducts.length / adminProductsPageSize));
  const currentAdminProductsPage = Math.min(adminProductsPage, adminProductsPageCount);
  const paginatedAdminProducts = adminFilteredProducts.slice(
    (currentAdminProductsPage - 1) * adminProductsPageSize,
    currentAdminProductsPage * adminProductsPageSize,
  );
  const adminStats = useMemo(() => {
    const activeSalesOrders = adminOrders.filter((order) => order.status !== 'cancelled');
    const grossSales = activeSalesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const deliveredSales = adminOrders.filter((order) => order.status === 'delivered').reduce((sum, order) => sum + Number(order.total || 0), 0);
    const openOrders = adminOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length;
    return {
      grossSales,
      deliveredSales,
      openOrders,
      averageOrder: activeSalesOrders.length ? grossSales / activeSalesOrders.length : 0,
    };
  }, [adminOrders]);
  const monthlySales = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      const total = adminOrders.reduce((sum, order) => {
        const date = new Date(order.createdAt);
        if (order.status === 'cancelled' || date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) return sum;
        return sum + Number(order.total || 0);
      }, 0);
      return { label: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(month), total };
    });
  }, [adminOrders]);

  const cartItems = products.filter((product) => cart[product._id]).map((product) => ({ ...product, quantity: cart[product._id] }));
  const checkoutItems = instantCheckoutItems || cartItems;
  const checkoutSubtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const savedProducts = products.filter((product) => wishlist.includes(product._id));
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const detailImages = detailProduct ? [...new Set([detailProduct.image, ...(Array.isArray(detailProduct.images) ? detailProduct.images : []), ...(Array.isArray(detailProduct.gallery) ? detailProduct.gallery : [])].filter(Boolean).map((image) => resolveProductImage(image, detailProduct.name)))] : [];
  const detailStock = Math.max(0, Number(detailProduct?.stock) || 0);
  const detailAddableStock = Math.max(0, detailStock - Number(cart[detailProduct?._id] || 0));
  const checkoutDiscount = Number(appliedCoupon?.discount || 0);
  const checkoutShippingFee = checkoutSubtotal === 0 || checkoutSubtotal >= 1500 ? 0 : 100;
  const checkoutTotal = Math.max(0, checkoutSubtotal - checkoutDiscount) + checkoutShippingFee;

  function closeProductDetails() {
    detailRequestRef.current += 1;
    setDetailProduct(null);
    setDetailLoading(false);
  }

  async function openProductDetails(product) {
    const requestId = ++detailRequestRef.current;
    setDetailProduct(product);
    setDetailImageIndex(0);
    setDetailQuantity(1);
    setDetailError('');
    setDetailReviews([]);
    if (!isObjectId(product._id) || catalogSource !== 'api') return;
    setDetailLoading(true);
    try {
      const [productResult, reviewsResult] = await Promise.all([
        apiRequest(`/products/${product._id}`),
        apiRequest(`/reviews/product/${product._id}`),
      ]);
      if (requestId === detailRequestRef.current) {
        setDetailProduct({ ...product, ...productResult.data, image: resolveProductImage(productResult.data.image, productResult.data.name) });
        setDetailReviews(reviewsResult.data || []);
      }
    } catch (error) {
      if (requestId === detailRequestRef.current) setDetailError(error.message || 'Could not load full product details.');
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }

  function openReviewForm(order, item) {
    const productId = typeof item.productId === 'object' ? item.productId?._id : item.productId;
    const existing = myReviews[reviewKey(order._id, productId)];
    setReviewTarget({ orderId: order._id, productId, name: item.name, existing });
    setReviewForm({ rating: existing?.rating || 5, comment: existing?.comment || '' });
  }

  async function submitProductReview(event) {
    event.preventDefault();
    if (!reviewTarget) return;
    setReviewSaving(true);
    try {
      const result = await apiRequest('/reviews', {
        method: 'POST',
        body: { orderId: reviewTarget.orderId, productId: reviewTarget.productId, rating: reviewForm.rating, comment: reviewForm.comment.trim() },
      });
      setMyReviews((previous) => ({ ...previous, [reviewKey(reviewTarget.orderId, reviewTarget.productId)]: result.data }));
      setReviewTarget(null);
      showNotice('Thanks! Your review was saved.');
      await Promise.all([loadOrders(), reloadProducts()]);
      if (detailProduct?._id === reviewTarget.productId) openProductDetails(detailProduct);
    } catch (error) {
      showNotice(error.message || 'Could not save your review.');
    } finally {
      setReviewSaving(false);
    }
  }

  async function addToCart(product, quantityToAdd = 1) {
    const amount = Math.max(1, Number(quantityToAdd) || 1);
    const newQuantity = Number(cart[product._id] || 0) + amount;
    if ((!token || catalogSource !== 'api') && Number.isFinite(Number(product.stock)) && newQuantity > Number(product.stock)) {
      showNotice(`Only ${product.stock} unit(s) of ${product.name} are in stock.`);
      return;
    }
    if (token && catalogSource === 'api' && isObjectId(product._id)) {
      try {
        const result = await apiRequest(`/carts/me/items/${product._id}`, { method: 'PATCH', body: { quantity: newQuantity } });
        setCart(cartMapFromResponse(result.data));
      } catch (error) {
        showNotice(error.message);
        return;
      }
    } else {
      setCart((previous) => ({ ...previous, [product._id]: (previous[product._id] || 0) + amount }));
    }
    showNotice(`${amount} × ${product.name} added to your bag${!token ? ' · sign in to sync across devices' : ''}`);
    setDetailProduct(null);
  }

  async function setCartQuantity(id, quantity) {
    const nextQuantity = Math.max(0, Number(quantity) || 0);
    if (token && catalogSource === 'api' && isObjectId(id)) {
      try {
        const result = await apiRequest(`/carts/me/items/${id}`, { method: 'PATCH', body: { quantity: nextQuantity } });
        setCart(cartMapFromResponse(result.data));
      } catch (error) {
        showNotice(error.message);
      }
      return;
    }
    setCart((previous) => {
      const next = { ...previous };
      if (nextQuantity <= 0) delete next[id];
      else next[id] = nextQuantity;
      return next;
    });
  }

  function changeQty(id, delta) { setCartQuantity(id, (Number(cart[id]) || 0) + delta); }
  function toggleWish(id) { setWishlist((previous) => previous.includes(id) ? previous.filter((savedId) => savedId !== id) : [...previous, id]); }
  function navigatePage(nextPage) {
    setPage(nextPage);
    setOrdersOpen(nextPage === 'orders');
    setCategory(({ fashion: 'Fashion', accessories: 'Accessories', tech: 'Tech', living: 'Home' })[nextPage] || 'All');
    setShopProductsPage(1);
    setMobileMenu(false);
    setMobileSearchOpen(false);
    setProfileMenuOpen(false);
    setCategoriesMenuOpen(false);
    const nextHash = `#/${nextPage}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, '', nextHash);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeShopProductsPage(nextPage) {
    setShopProductsPage(Math.min(shopProductsPageCount, Math.max(1, nextPage)));
    window.requestAnimationFrame(() => document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleMobileSearch() {
    if (mobileSearchOpen) {
      setMobileSearchOpen(false);
      return;
    }
    setMobileSearchOpen(true);
    window.requestAnimationFrame(() => headerSearchInputRef.current?.focus());
  }

  function goProducts() { navigatePage('shop'); }

  function openOrders() {
    setMobileMenu(false);
    setProfileMenuOpen(false);
    if (!token || !user) {
      setAuthMode('login');
      setAccountOpen(true);
      showNotice('Sign in to view and track your orders.');
      return;
    }
    navigatePage('orders');
  }

  function openAdmin() {
    setMobileMenu(false);
    if (!token || !user) {
      setAuthMode('login');
      setAccountOpen(true);
      showNotice('Sign in with an admin account to open the dashboard.');
      return;
    }
    if (user.role !== 'admin') {
      showNotice('The admin dashboard is only available to admin accounts.');
      return;
    }
    navigatePage('admin');
  }

  async function saveAdminOrderStatus(orderId, currentStatus) {
    const status = adminStatusDrafts[orderId] || currentStatus;
    if (status === currentStatus) return;
    setSavingOrderId(orderId);
    try {
      const result = await apiRequest(`/orders/${orderId}`, { method: 'PATCH', body: { status } });
      setAdminOrders((previous) => previous.map((order) => order._id === orderId ? result.data : order));
      setAdminStatusDrafts((previous) => { const next = { ...previous }; delete next[orderId]; return next; });
      showNotice(`Order #${String(orderId).slice(-8).toUpperCase()} updated to ${orderStatusLabel(status)}.`);
    } catch (error) {
      showNotice(error.message || 'Could not update this order.');
    } finally {
      setSavingOrderId('');
    }
  }

  async function cancelCustomerOrder(order) {
    setCancellingOrderId(order._id);
    try {
      const result = await apiRequest(`/orders/${order._id}/cancel`, { method: 'PATCH' });
      setOrders((previous) => previous.map((item) => item._id === order._id ? result.data : item));
      setCancelOrderTarget(null);
      showNotice(result.message || 'Your order has been cancelled.');
      await reloadProducts();
    } catch (error) {
      setCancelOrderTarget(null);
      showNotice(error.message || 'Could not cancel this order. Please refresh and try again.');
    } finally {
      setCancellingOrderId('');
    }
  }

  function resetProductForm() {
    setEditingProductId('');
    setProductImageFile(null);
    setProductForm({ name: '', category: 'Fashion', description: '', price: '', oldPrice: '', stock: '', rating: '4.8', reviews: '0', tag: '', image: '', bg: '#e2efff' });
  }

  function editProduct(product) {
    setEditingProductId(product._id);
    setProductImageFile(null);
    setProductForm({
      name: product.name || '', category: product.category || 'Fashion', description: product.description || '',
      price: String(product.price ?? ''), oldPrice: product.oldPrice == null ? '' : String(product.oldPrice),
      stock: String(product.stock ?? 0), rating: String(product.rating ?? 0), reviews: String(product.reviews ?? 0),
      tag: product.tag || '', image: product.sourceImage || product.image || '', bg: product.bg || '#e2efff',
    });
    document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveProduct(event) {
    event.preventDefault();
    setProductSaving(true);
    let image = productForm.image.trim();
    try {
      if (productImageFile) {
        const token = window.localStorage.getItem('skyshop-token');
        const uploadResponse = await fetch(`${API_BASE_URL}/products/image`, {
          method: 'POST',
          headers: { 'Content-Type': productImageFile.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: productImageFile,
        });
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadResult.message || 'Could not upload this image.');
        const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
        image = `${apiOrigin}${uploadResult.data.image}`;
        setProductForm((previous) => ({ ...previous, image }));
        setProductImageFile(null);
      }
    } catch (error) {
      setProductSaving(false);
      showNotice(error.message || 'Could not upload this image.');
      return;
    }
    const payload = {
      name: productForm.name.trim(), category: productForm.category, description: productForm.description.trim(),
      price: Number(productForm.price), stock: Number(productForm.stock), rating: Number(productForm.rating),
      reviews: Number(productForm.reviews || 0), tag: productForm.tag.trim(), image, bg: productForm.bg,
    };
    if (productForm.oldPrice !== '') payload.oldPrice = Number(productForm.oldPrice);
    try {
      const result = await apiRequest(editingProductId ? `/products/${editingProductId}` : '/products', {
        method: editingProductId ? 'PATCH' : 'POST', body: payload,
      });
      resetProductForm();
      await reloadProducts();
      showNotice(result.message || (editingProductId ? 'Product updated.' : 'Product added.'));
    } catch (error) {
      showNotice(error.message || 'Could not save this product.');
    } finally {
      setProductSaving(false);
    }
  }

  function chooseProductImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!supportedTypes.includes(file.type)) {
      showNotice('Choose a JPG, PNG, WebP, GIF, or AVIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotice('Choose an image smaller than 5 MB.');
      return;
    }
    setProductImageFile(file);
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.name}”?`)) return;
    try {
      const result = await apiRequest(`/products/${product._id}`, { method: 'DELETE' });
      if (editingProductId === product._id) resetProductForm();
      await reloadProducts();
      showNotice(result.message || 'Product deleted.');
    } catch (error) {
      showNotice(error.message || 'Could not delete this product.');
    }
  }

  function resetCouponForm() {
    setEditingCouponId('');
    setCouponForm(emptyCouponForm());
  }

  function editCoupon(coupon) {
    setEditingCouponId(coupon._id);
    setCouponForm({
      code: coupon.code || '', type: coupon.type || 'percentage', value: String(coupon.value ?? ''),
      minimumSubtotal: String(coupon.minimumSubtotal ?? 0), maxDiscount: coupon.maxDiscount == null ? '' : String(coupon.maxDiscount),
      usageLimit: coupon.usageLimit == null ? '' : String(coupon.usageLimit), startsAt: toLocalDateTime(coupon.startsAt),
      expiresAt: toLocalDateTime(coupon.expiresAt), active: coupon.active !== false,
    });
    document.getElementById('admin-coupon-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveCoupon(event) {
    event.preventDefault();
    setCouponSaving(true);
    const payload = {
      ...couponForm,
      code: couponForm.code.trim().toUpperCase(),
      value: Number(couponForm.value),
      minimumSubtotal: Number(couponForm.minimumSubtotal || 0),
      maxDiscount: couponForm.type === 'percentage' && couponForm.maxDiscount !== '' ? Number(couponForm.maxDiscount) : null,
      usageLimit: couponForm.usageLimit !== '' ? Number(couponForm.usageLimit) : null,
      startsAt: couponForm.startsAt ? new Date(couponForm.startsAt).toISOString() : null,
      expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
    };
    try {
      const result = await apiRequest(editingCouponId ? `/coupons/${editingCouponId}` : '/coupons', {
        method: editingCouponId ? 'PATCH' : 'POST', body: payload,
      });
      resetCouponForm();
      await loadCoupons();
      showNotice(result.message || (editingCouponId ? 'Coupon updated.' : 'Coupon created.'));
    } catch (error) {
      showNotice(error.message || 'Could not save this coupon.');
    } finally {
      setCouponSaving(false);
    }
  }

  async function deleteCoupon(coupon) {
    if (!window.confirm(`Delete coupon “${coupon.code}”?`)) return;
    try {
      const result = await apiRequest(`/coupons/${coupon._id}`, { method: 'DELETE' });
      if (editingCouponId === coupon._id) resetCouponForm();
      await loadCoupons();
      showNotice(result.message || 'Coupon deleted.');
    } catch (error) {
      showNotice(error.message || 'Could not delete this coupon.');
    }
  }

  async function applyCheckoutCoupon() {
    setCouponApplying(true);
    setCouponError('');
    try {
      const result = await apiRequest('/coupons/validate', {
        method: 'POST', body: { code: couponCodeInput.trim(), subtotal: checkoutSubtotal },
      });
      setAppliedCoupon(result.data);
      setCouponCodeInput(result.data.code);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponError(error.message || 'Could not apply this coupon.');
    } finally {
      setCouponApplying(false);
    }
  }

  async function copyVoucherCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showNotice(`${code} copied. Enter it at checkout.`);
    } catch {
      setCouponCodeInput(code);
      showNotice(`Use ${code} at checkout.`);
    }
  }

  function openAccount() {
    setProfileMenuOpen((open) => !open);
  }

  async function saveAccountProfile(event) {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const result = await apiRequest('/auth/me', { method: 'PATCH', body: {
        firstName: profileForm.firstName.trim(), lastName: profileForm.lastName.trim(), email: profileForm.email.trim(), phone: profileForm.phone.trim(),
        shippingAddress: {
          addressLine1: profileForm.addressLine1.trim(), addressLine2: profileForm.addressLine2.trim(), city: profileForm.city.trim(),
          province: profileForm.province.trim(), postalCode: profileForm.postalCode.trim(), country: profileForm.country.trim() || 'Philippines',
        },
      } });
      setUser(result.data);
      window.localStorage.setItem('skyshop-user', JSON.stringify(result.data));
      setCheckoutForm((previous) => ({
        ...previous, name: `${result.data.firstName} ${result.data.lastName}`.trim(), email: result.data.email, phone: result.data.phone || '',
        ...checkoutAddressFromUser(result.data),
      }));
      showNotice(result.message || 'Personal information saved.');
    } catch (error) {
      showNotice(error.message || 'Could not save your personal information.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function changeAccountPassword(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotice('Your new passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await apiRequest('/auth/me/password', { method: 'PATCH', body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword } });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotice(result.message || 'Password changed.');
    } catch (error) {
      showNotice(error.message || 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const body = authMode === 'register'
        ? { firstName: authForm.firstName.trim(), lastName: authForm.lastName.trim(), email: authForm.email.trim(), password: authForm.password, phone: authForm.phone.trim() }
        : { email: authForm.email.trim(), password: authForm.password };
      const result = await apiRequest(`/auth/${authMode}`, { method: 'POST', body });
      pendingGuestCart.current = { ...cart };
      writeSavedValue('skyshop-token', result.token);
      writeSavedValue('skyshop-user', JSON.stringify(result.data));
      setToken(result.token);
      setUser(result.data);
      setAuthForm({ firstName: '', lastName: '', email: '', password: '', phone: '' });
      setAccountOpen(false);
      if (result.data.role === 'admin') navigatePage('admin');
      setProfileForm(profileFormFromUser(result.data));
      setCheckoutForm((previous) => ({ ...previous, name: `${result.data.firstName} ${result.data.lastName}`.trim(), email: result.data.email, phone: result.data.phone || '', ...checkoutAddressFromUser(result.data) }));
      if (result.data.role !== 'admin' && instantCheckoutItems?.length) openCheckoutWithItems(instantCheckoutItems, result.data);
      showNotice(result.message || 'You are signed in.');
    } catch (error) {
      showNotice(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function signOut() {
    removeSavedValue('skyshop-token');
    removeSavedValue('skyshop-user');
    setToken('');
    setUser(null);
    setCart({});
    setOrdersOpen(false);
    setPage('landing');
    window.history.replaceState(null, '', window.location.pathname);
    setAccountOpen(false);
    setProfileMenuOpen(false);
    setLogoutConfirmOpen(false);
    showNotice('You have signed out. Your saved server cart is still available when you sign in again.');
  }

  function requestSignOut() {
    setProfileMenuOpen(false);
    setLogoutConfirmOpen(true);
  }

  function openCheckoutWithItems(items, account = user) {
    if (catalogSource !== 'api') {
      showNotice('The backend is unavailable. Start the server and reload products before checking out.');
      return;
    }
    setInstantCheckoutItems(items === cartItems ? null : items);
    setCheckoutForm((previous) => ({
      ...previous,
      name: `${account?.firstName || ''} ${account?.lastName || ''}`.trim(),
      email: account?.email || '',
      phone: account?.phone || '',
      ...checkoutAddressFromUser(account),
    }));
    setCheckoutOpen(true);
  }

  function buyNow(product) {
    if (Number(product.stock) <= 0) {
      showNotice(`${product.name} is currently out of stock.`);
      return;
    }
    const items = [{ ...product, quantity: 1 }];
    setDetailProduct(null);
    setCouponCodeInput('');
    setCouponError('');
    setAppliedCoupon(null);
    if (!token || !user) {
      setInstantCheckoutItems(items);
      setAuthMode('login');
      setAccountOpen(true);
      showNotice('Sign in to continue with your purchase. Your bag will stay unchanged.');
      return;
    }
    openCheckoutWithItems(items);
  }

  function startCheckout() {
    if (!cartItems.length) {
      showNotice('Add a product to your bag before checking out.');
      return;
    }
    if (!token || !user) {
      setCartOpen(false);
      setAuthMode('login');
      setAccountOpen(true);
      showNotice('Sign in or create an account to place your order.');
      return;
    }
    openCheckoutWithItems(cartItems);
  }

  function closeCheckout() {
    if (instantCheckoutItems) {
      setAppliedCoupon(null);
      setCouponCodeInput('');
      setCouponError('');
    }
    setCheckoutOpen(false);
    setInstantCheckoutItems(null);
  }

  async function handleCheckoutSubmit(event) {
    event.preventDefault();
    if (!checkoutItems.length) {
      showNotice('Your bag is empty.');
      setCheckoutOpen(false);
      return;
    }
    setCheckoutLoading(true);
    try {
      const payload = {
        customer: { name: checkoutForm.name.trim(), email: checkoutForm.email.trim(), phone: checkoutForm.phone.trim() },
        shippingAddress: {
          addressLine1: checkoutForm.addressLine1.trim(),
          addressLine2: checkoutForm.addressLine2.trim(),
          city: checkoutForm.city.trim(),
          province: checkoutForm.province.trim(),
          postalCode: checkoutForm.postalCode.trim(),
          country: checkoutForm.country.trim() || 'Philippines',
        },
        items: checkoutItems.map((item) => ({ productId: item._id, quantity: item.quantity })),
        paymentMethod: checkoutForm.paymentMethod,
        notes: checkoutForm.notes.trim(),
        couponCode: appliedCoupon?.code || '',
      };
      const result = await apiRequest('/orders', { method: 'POST', body: payload });
      if (!instantCheckoutItems) setCart({});
      setInstantCheckoutItems(null);
      setCheckoutOpen(false);
      setCartOpen(false);
      setAppliedCoupon(null);
      setCouponCodeInput('');
      navigatePage('orders');
      await reloadProducts();
      showNotice(`Order placed successfully · ${String(result.data?._id || '').slice(-8).toUpperCase()}`);
    } catch (error) {
      showNotice(error.message || 'Checkout failed. Please review your details and try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
      <div className="app-shell">
          <header className={page === 'admin' || isAdmin ? 'site-header admin-header' : 'site-header'}>
              <button
                  className="mobile-menu icon-button"
                  onClick={() => setMobileMenu(!mobileMenu)}
                  aria-label="Toggle menu"
              >
                  <Menu size={21} />
              </button>
              <a className="brand" href={isAdmin ? '#/admin' : '#/landing'} aria-label={isAdmin ? 'Admin dashboard' : 'SkyShop home'} onClick={(event) => { event.preventDefault(); navigatePage(isAdmin ? 'admin' : 'landing'); }}>
                  <span className="brand-mark">
                      <span></span>
                      <span></span>
                      <span></span>
                  </span>
                  <span>
                      skyshop<span className="brand-period">.</span>
                  </span>
              </a>
              <nav className={mobileMenu ? "main-nav nav-open" : "main-nav"}>
                  {page === 'admin' || isAdmin ? (
                    <>
                      <button className={adminSection === 'dashboard' ? 'nav-orders-link active' : 'nav-orders-link'} type="button" onClick={() => { setAdminSection('dashboard'); setMobileMenu(false); }}>Dashboard</button>
                      <button className={adminSection === 'products' ? 'nav-orders-link active' : 'nav-orders-link'} type="button" onClick={() => { setAdminSection('products'); setMobileMenu(false); }}>Products</button>
                      <button className={adminSection === 'coupons' ? 'nav-orders-link active' : 'nav-orders-link'} type="button" onClick={() => { setAdminSection('coupons'); setMobileMenu(false); }}>Coupons</button>
                      <button className={adminSection === 'users' ? 'nav-orders-link active' : 'nav-orders-link'} type="button" onClick={() => { setAdminSection('users'); setAdminUsersPage(1); setMobileMenu(false); }}>Users</button>
                    </>
                  ) : (
                    <>
                  <a className={page === 'landing' ? 'active' : ''} href="#/landing" onClick={(event) => { event.preventDefault(); navigatePage('landing'); }}>Home</a>
                  <a className={page === 'shop' ? 'active' : ''} href="#/shop" onClick={(event) => { event.preventDefault(); navigatePage('shop'); }}>Shop all</a>
                  <a className={page === 'new-arrivals' ? 'active' : ''} href="#/new-arrivals" onClick={(event) => { event.preventDefault(); navigatePage('new-arrivals'); }}>New arrivals</a>
                  <div className="categories-nav-wrap" ref={categoriesMenuRef}>
                    <button className={`nav-orders-link categories-nav-trigger ${['fashion', 'accessories', 'tech', 'living'].includes(page) ? 'active' : ''}`} type="button" aria-haspopup="menu" aria-expanded={categoriesMenuOpen} onClick={() => setCategoriesMenuOpen((open) => !open)}>
                      Categories <ChevronDown size={14} className={categoriesMenuOpen ? 'profile-chevron is-open' : 'profile-chevron'} />
                    </button>
                    {categoriesMenuOpen && <div className="categories-dropdown" role="menu" aria-label="Product categories">
                      {[['fashion', 'Fashion'], ['accessories', 'Accessories'], ['tech', 'Tech'], ['living', 'Home & Living']].map(([route, label]) => <button key={route} type="button" role="menuitem" className={page === route ? 'active' : ''} onClick={() => navigatePage(route)}>{label}</button>)}
                    </div>}
                  </div>
                  <a className={page === 'vouchers' ? 'active' : ''} href="#/vouchers" onClick={(event) => { event.preventDefault(); navigatePage('vouchers'); }}>Vouchers</a>
                  <a className={page === 'story' ? 'active' : ''} href="#/story" onClick={(event) => { event.preventDefault(); navigatePage('story'); }}>Our story</a>
                  {user?.role === 'admin' && (
                      <button className={page === 'admin' ? 'nav-orders-link active' : 'nav-orders-link'} type="button" onClick={openAdmin}>
                          Admin dashboard
                      </button>
                  )}
                    </>
                  )}
              </nav>
              <div className="header-actions">
                  {isAdmin ? null : page === 'admin' ? (
                    <button className="admin-view-store" type="button" onClick={() => navigatePage('landing')}>View store</button>
                  ) : (
                    <>
                  <div className={`header-search ${mobileSearchOpen ? 'mobile-search-open' : ''}`} role="search">
                      <button type="button" className="header-search-toggle" onClick={toggleMobileSearch} aria-label={mobileSearchOpen ? 'Close search' : 'Open search'} aria-expanded={mobileSearchOpen}>
                          {mobileSearchOpen ? <X size={18} /> : <Search size={17} />}
                      </button>
                      <input
                          ref={headerSearchInputRef}
                          aria-label="Search products"
                          placeholder="Find your next fave..."
                          value={search}
                          onChange={(event) => {
                              setSearch(event.target.value);
                              setShopProductsPage(1);
                              if (event.target.value) {
                                  if (page === 'story' || page === 'orders') {
                                      navigatePage('shop');
                                      if (window.matchMedia('(max-width: 800px)').matches) {
                                          setMobileSearchOpen(true);
                                          window.requestAnimationFrame(() => headerSearchInputRef.current?.focus());
                                      }
                                      window.setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }), 0);
                                  } else {
                                      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
                                  }
                              }
                          }}
                      />
                      <kbd>⌘ K</kbd>
                  </div>
                    </>
                  )}
                  {page !== 'admin' && !isAdmin && (
                    <button className="bag-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cartCount} items`}>
                        <ShoppingBag size={19} /><span className="bag-count" aria-hidden="true">{cartCount > 9 ? '9+' : cartCount}</span>
                    </button>
                  )}
                  <div className="profile-menu-wrap" ref={profileMenuRef}>
                      <button className="account-button" type="button" onClick={openAccount} aria-haspopup="menu" aria-expanded={profileMenuOpen} aria-label="Open profile menu">
                          <UserRound size={17} /><span>{user ? 'Profile' : 'Account'}</span><ChevronDown size={14} className={profileMenuOpen ? 'profile-chevron is-open' : 'profile-chevron'} />
                      </button>
                      {profileMenuOpen && <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                          {user && <div className="profile-dropdown-user"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div>}
                          {user ? <>
                              <button type="button" role="menuitem" onClick={openOrders}><Package size={16} />My orders</button>
                              <button type="button" role="menuitem" onClick={() => navigatePage('wishlist')}><Heart size={16} />My wishlist{wishlist.length > 0 && <span className="profile-menu-count">{wishlist.length}</span>}</button>
                              {user.role !== 'admin' && <button type="button" role="menuitem" onClick={() => navigatePage('settings')}><UserRound size={16} />Settings</button>}
                              <div className="profile-dropdown-divider" />
                              <button type="button" role="menuitem" className="profile-logout-item" onClick={requestSignOut}><LogOut size={16} />Log out</button>
                          </> : <>
                              <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setAuthMode('login'); setAccountOpen(true); }}><LockKeyhole size={16} />Sign in</button>
                              <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setAuthMode('register'); setAccountOpen(true); }}><UserRound size={16} />Create account</button>
                          </>}
                      </div>}
                  </div>
              </div>
          </header>

          <main id="top" className={`page-${page} ${ordersOpen ? "orders-mode" : ""} ${page === 'admin' ? 'admin-mode' : ''}`}>
              <section className="admin-page" aria-labelledby="admin-title">
                  {user?.role !== 'admin' ? (
                      <div className="orders-empty admin-access-message">
                          <span className="orders-empty-icon"><LockKeyhole size={24} /></span>
                          <h2>Admin access required.</h2>
                          <p>Sign in with an admin account to view store statistics and manage orders.</p>
                          <button className="primary-button" type="button" onClick={openAccount}>Sign in <ArrowRight size={16} /></button>
                      </div>
                  ) : (
                      <>
                          <div className="admin-heading">
                              <div>
                                  <div className="eyebrow"><span className="eyebrow-line" /> STORE MANAGEMENT</div>
                                  <h1 id="admin-title">{adminSection === 'dashboard' ? <>Admin <em>dashboard.</em></> : adminSection === 'products' ? <>Product <em>catalog.</em></> : adminSection === 'coupons' ? <>Coupon <em>offers.</em></> : <>Customer <em>accounts.</em></>}</h1>
                                  <p>{adminSection === 'dashboard' ? 'Track sales performance and update order status.' : adminSection === 'products' ? 'Add, edit, and manage products in your store.' : adminSection === 'coupons' ? 'Create discounts and control when shoppers can use them.' : 'View the people who have registered for SkyShop.'}</p>
                              </div>
                              {adminSection === 'dashboard' ? (
                                  <button type="button" className="secondary-button orders-refresh" onClick={loadAdminOrders} disabled={adminLoading}>
                                      <RefreshCw size={16} className={adminLoading ? 'spin-icon' : ''} /> Refresh data
                                  </button>
                              ) : adminSection === 'products' ? (
                                  <button type="button" className="secondary-button orders-refresh" onClick={reloadProducts} disabled={catalogLoading}>
                                      <RefreshCw size={16} className={catalogLoading ? 'spin-icon' : ''} /> Refresh products
                                  </button>
                              ) : adminSection === 'coupons' ? (
                                  <button type="button" className="secondary-button orders-refresh" onClick={loadCoupons} disabled={couponsLoading}>
                                      <RefreshCw size={16} className={couponsLoading ? 'spin-icon' : ''} /> Refresh coupons
                                  </button>
                              ) : (
                                  <button type="button" className="secondary-button orders-refresh" onClick={loadAdminUsers} disabled={adminUsersLoading}>
                                      <RefreshCw size={16} className={adminUsersLoading ? 'spin-icon' : ''} /> Refresh users
                                  </button>
                              )}
                          </div>
                          {adminSection === 'dashboard' ? (
                            <>
                          <div className="admin-stat-grid">
                              <article className="admin-stat-card"><span className="admin-stat-icon"><DollarSign size={18} /></span><small>Gross sales</small><strong>{peso(adminStats.grossSales)}</strong><span>Excludes cancelled orders</span></article>
                              <article className="admin-stat-card"><span className="admin-stat-icon"><TrendingUp size={18} /></span><small>Delivered sales</small><strong>{peso(adminStats.deliveredSales)}</strong><span>Orders marked delivered</span></article>
                              <article className="admin-stat-card"><span className="admin-stat-icon"><Clock3 size={18} /></span><small>Open orders</small><strong>{adminStats.openOrders}</strong><span>Awaiting delivery</span></article>
                              <article className="admin-stat-card"><span className="admin-stat-icon"><Package size={18} /></span><small>Products listed</small><strong>{products.length}</strong><span>In the store catalog</span></article>
                          </div>
                          <div className="admin-sales-panel">
                              <div className="admin-panel-heading"><div><h2>Sales overview</h2><p>Gross order totals for the last six months</p></div><strong>Avg. order {peso(adminStats.averageOrder)}</strong></div>
                              <div className="sales-bars" role="img" aria-label="Monthly gross order totals for the last six months">
                                  {monthlySales.map((month) => {
                                    const maxSales = Math.max(1, ...monthlySales.map((item) => item.total));
                                    return <div className="sales-bar-column" key={`${month.label}-${month.total}`} title={`${month.label}: ${peso(month.total)}`}><span className="sales-bar-value">{month.total ? peso(month.total) : '—'}</span><div className="sales-bar-track"><span style={{ height: `${month.total ? Math.max(8, (month.total / maxSales) * 100) : 0}%` }} /></div><small>{month.label}</small></div>;
                                  })}
                              </div>
                              <p className="admin-revenue-note">Sales are gross order totals, not net profit. Product cost data is not recorded yet.</p>
                          </div>
                          <div className="admin-orders-heading">
                              <div><h2>Manage orders</h2><p>{adminOrders.length} order{adminOrders.length === 1 ? '' : 's'} in the system</p></div>
                              <label className="admin-status-filter">Status
                                  <select value={adminStatusFilter} onChange={(event) => setAdminStatusFilter(event.target.value)}>
                                      <option value="all">All statuses</option>
                                      <option value="pending">Order placed</option>
                                      <option value="processing">Preparing</option>
                                      <option value="shipped">On the way</option>
                                      <option value="delivered">Delivered</option>
                                      <option value="cancelled">Cancelled</option>
                                  </select>
                              </label>
                          </div>
                          {adminLoading && !adminOrders.length ? <div className="orders-state"><LoaderCircle className="spin-icon" size={22} /> Loading store data…</div>
                            : adminError ? <div className="orders-state orders-error" role="alert"><p>{adminError}</p><button className="secondary-button" type="button" onClick={loadAdminOrders}>Try again</button></div>
                              : adminFilteredOrders.length ? (
                                  <div className="admin-order-list">
                                      {adminFilteredOrders.map((order) => (
                                          <article className="admin-order-row" key={order._id}>
                                              <div className="admin-order-main"><strong>#{String(order._id).slice(-8).toUpperCase()}</strong><span>{order.customer?.name || 'Customer'}</span><small>{order.customer?.email || order.userId?.email || ''}</small></div>
                                              <div className="admin-order-meta"><span>{order.createdAt ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(order.createdAt)) : 'Date unavailable'}</span><span>{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}</span><strong>{peso(order.total)}</strong></div>
                                              <div className="admin-order-actions">
                                                  <select aria-label={`Status for order ${String(order._id).slice(-8)}`} value={adminStatusDrafts[order._id] || order.status} disabled={order.status === 'cancelled'} onChange={(event) => setAdminStatusDrafts((previous) => ({ ...previous, [order._id]: event.target.value }))}>
                                                      <option value="pending">Order placed</option><option value="processing">Preparing</option><option value="shipped">On the way</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
                                                  </select>
                                                  <button className="primary-button admin-save-button" type="button" disabled={order.status === 'cancelled' || savingOrderId === order._id || !adminStatusDrafts[order._id] || adminStatusDrafts[order._id] === order.status} onClick={() => saveAdminOrderStatus(order._id, order.status)}>
                                                      {savingOrderId === order._id ? <LoaderCircle size={15} className="spin-icon" /> : <Save size={15} />} Save
                                                  </button>
                                              </div>
                                          </article>
                                      ))}
                                  </div>
                              ) : <div className="orders-empty"><h2>No orders match this status.</h2><p>Try another filter or check again after a new order comes in.</p></div>}
                            </>
                          ) : adminSection === 'products' ? (
                            <section className="admin-products-workspace" aria-label="Product management">
                                <form className="admin-product-form" id="admin-product-form" onSubmit={saveProduct}>
                                    <div className="admin-product-form-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> CATALOG CRUD</span><h2>{editingProductId ? 'Edit product' : 'Add a product'}</h2></div>{editingProductId && <button type="button" className="admin-cancel-edit" onClick={resetProductForm}>Cancel edit</button>}</div>
                                    <div className="admin-product-fields">
                                        <label className="admin-field-wide">Product name<input required minLength="2" maxLength="120" value={productForm.name} onChange={(event) => setProductForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="e.g. Everyday Tote" /></label>
                                        <label>Category<select value={productForm.category} onChange={(event) => setProductForm((previous) => ({ ...previous, category: event.target.value }))}><option>Fashion</option><option>Accessories</option><option>Tech</option><option>Home</option></select></label>
                                        <label>Price (₱)<input required type="number" min="0" step="1" value={productForm.price} onChange={(event) => setProductForm((previous) => ({ ...previous, price: event.target.value }))} /></label>
                                        <label>Old price (₱)<input type="number" min="0" step="1" value={productForm.oldPrice} onChange={(event) => setProductForm((previous) => ({ ...previous, oldPrice: event.target.value }))} /></label>
                                        <label>Stock<input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm((previous) => ({ ...previous, stock: event.target.value }))} /></label>
                                        <label>Rating<input type="number" min="0" max="5" step="0.1" value={productForm.rating} onChange={(event) => setProductForm((previous) => ({ ...previous, rating: event.target.value }))} /></label>
                                        <label>Reviews<input type="number" min="0" step="1" value={productForm.reviews} onChange={(event) => setProductForm((previous) => ({ ...previous, reviews: event.target.value }))} /></label>
                                        <label>Product tag<input maxLength="40" value={productForm.tag} onChange={(event) => setProductForm((previous) => ({ ...previous, tag: event.target.value }))} placeholder="New, Bestseller…" /></label>
                                        <div className="admin-field-wide admin-product-image-field">
                                            <span>Product image</span>
                                            <input ref={productImageInputRef} className="admin-product-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={chooseProductImage} aria-label="Choose a product image from your device" />
                                            <div className="admin-product-image-picker">
                                                <img src={productImagePreview || (productForm.image ? resolveProductImage(productForm.image, productForm.name) : placeholderImage)} alt={productImageFile?.name || (productForm.image ? 'Current product image' : 'Product image preview')} />
                                                <div className="admin-product-image-picker-copy"><strong>{productImageFile?.name || (productForm.image ? 'Current image' : 'No image selected')}</strong><small>{productImageFile ? `${(productImageFile.size / (1024 * 1024)).toFixed(2)} MB · ready to upload` : 'Choose an image from your device. JPG, PNG, WebP, GIF, or AVIF · max 5 MB.'}</small></div>
                                                <button type="button" className="secondary-button admin-choose-image" onClick={() => productImageInputRef.current?.click()}><ImagePlus size={17} />{productImageFile || productForm.image ? 'Change image' : 'Choose image'}</button>
                                            </div>
                                            <small>The image is uploaded to the store when you save this product.</small>
                                        </div>
                                        <label>Image background<input type="color" value={productForm.bg} onChange={(event) => setProductForm((previous) => ({ ...previous, bg: event.target.value }))} /></label>
                                        <label className="admin-field-wide">Description<textarea required maxLength="1000" rows="3" value={productForm.description} onChange={(event) => setProductForm((previous) => ({ ...previous, description: event.target.value }))} placeholder="Describe this product" /></label>
                                    </div>
                                    <button className="primary-button admin-product-submit" type="submit" disabled={productSaving || catalogSource !== 'api'}>{productSaving ? <LoaderCircle size={16} className="spin-icon" /> : <Save size={16} />}{editingProductId ? 'Save changes' : 'Add product'}</button>
                                </form>
                                <div className="admin-products-list-heading">
                                    <div><h2>Store products</h2><p>Manage the items available in your catalog.</p></div>
                                    <div className="admin-inventory-toolbar">
                                        <label className="admin-inventory-search"><Search size={15} /><input value={adminProductQuery} onChange={(event) => { setAdminProductQuery(event.target.value); setAdminProductsPage(1); }} placeholder="Search products" aria-label="Search admin products" /></label>
                                        <button type="button" className="primary-button admin-add-product-shortcut" onClick={() => { resetProductForm(); document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Plus size={15} />Add product</button>
                                    </div>
                                </div>
                                <div className="admin-inventory-count">Showing {adminFilteredProducts.length ? (currentAdminProductsPage - 1) * adminProductsPageSize + 1 : 0}–{Math.min(currentAdminProductsPage * adminProductsPageSize, adminFilteredProducts.length)} of {adminFilteredProducts.length} matching products ({products.length} total)</div>
                                {catalogLoading ? <div className="orders-state"><LoaderCircle className="spin-icon" size={22} /> Loading products…</div> : (
                                    <div className="admin-product-list">
                                        {paginatedAdminProducts.map((product) => (
                                            <article className="admin-product-row" key={product._id}>
                                                <img src={product.image || placeholderImage} alt={product.name} />
                                                <div className="admin-product-summary">
                                                    <div className="admin-product-name-line"><strong>{product.name}</strong><span className="admin-product-category">{product.category}</span></div>
                                                    <div className="admin-product-stock-line"><b>{peso(product.price)}</b><small className={product.stock <= 5 ? 'admin-stock-pill low-stock' : 'admin-stock-pill'}>{product.stock <= 5 && <span className="stock-warning-dot" />} {product.stock} in stock</small></div>
                                                </div>
                                                <div className="admin-product-actions"><button type="button" className="secondary-button" onClick={() => editProduct(product)}>Edit</button><button type="button" className="admin-delete-button" onClick={() => deleteProduct(product)}>Delete</button></div>
                                            </article>
                                        ))}
                                        {!adminFilteredProducts.length && <div className="admin-inventory-empty"><Package size={22} /><strong>{products.length ? 'No matching products' : 'No products loaded yet'}</strong><span>{products.length ? 'Try a different product name or category.' : 'Add your first product to start building the catalog.'}</span></div>}
                                    </div>
                                )}
                                {!catalogLoading && adminFilteredProducts.length > adminProductsPageSize && <div className="admin-users-pagination admin-products-pagination"><span>Page {currentAdminProductsPage} of {adminProductsPageCount} · 10 products per page</span><div><button className="secondary-button" type="button" onClick={() => setAdminProductsPage((current) => Math.max(1, current - 1))} disabled={currentAdminProductsPage <= 1}>Previous</button><button className="secondary-button" type="button" onClick={() => setAdminProductsPage((current) => Math.min(adminProductsPageCount, current + 1))} disabled={currentAdminProductsPage >= adminProductsPageCount}>Next</button></div></div>}
                            </section>
                          ) : adminSection === 'coupons' ? (
                            <section className="admin-coupons-workspace" aria-label="Coupon management">
                              <form className="admin-product-form" id="admin-coupon-form" onSubmit={saveCoupon}>
                                <div className="admin-product-form-heading">
                                  <div><span className="eyebrow"><span className="eyebrow-line" /> PROMOTION CRUD</span><h2>{editingCouponId ? 'Edit coupon' : 'Create a coupon'}</h2></div>
                                  {editingCouponId && <button type="button" className="admin-cancel-edit" onClick={resetCouponForm}>Cancel edit</button>}
                                </div>
                                <div className="admin-product-fields admin-coupon-fields">
                                  <label>Coupon code<input required minLength="3" maxLength="32" pattern="[A-Za-z0-9_-]+" value={couponForm.code} onChange={(event) => setCouponForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} placeholder="e.g. BLUE15" /></label>
                                  <label>Discount type<select value={couponForm.type} onChange={(event) => setCouponForm((previous) => ({ ...previous, type: event.target.value }))}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₱)</option></select></label>
                                  <label>{couponForm.type === 'percentage' ? 'Percent off' : 'Amount off (₱)'}<input required type="number" min="0.01" max={couponForm.type === 'percentage' ? '100' : undefined} step="0.01" value={couponForm.value} onChange={(event) => setCouponForm((previous) => ({ ...previous, value: event.target.value }))} /></label>
                                  <label>Minimum spend (₱)<input type="number" min="0" step="1" value={couponForm.minimumSubtotal} onChange={(event) => setCouponForm((previous) => ({ ...previous, minimumSubtotal: event.target.value }))} /></label>
                                  {couponForm.type === 'percentage' && <label>Discount cap (₱)<input type="number" min="0" step="1" value={couponForm.maxDiscount} onChange={(event) => setCouponForm((previous) => ({ ...previous, maxDiscount: event.target.value }))} placeholder="No cap" /></label>}
                                  <label>Use limit<input type="number" min="1" step="1" value={couponForm.usageLimit} onChange={(event) => setCouponForm((previous) => ({ ...previous, usageLimit: event.target.value }))} placeholder="Unlimited" /></label>
                                  <label>Starts at<input type="datetime-local" value={couponForm.startsAt} onChange={(event) => setCouponForm((previous) => ({ ...previous, startsAt: event.target.value }))} /></label>
                                  <label>Expires at<input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm((previous) => ({ ...previous, expiresAt: event.target.value }))} /></label>
                                  <label className="admin-coupon-active"><input type="checkbox" checked={couponForm.active} onChange={(event) => setCouponForm((previous) => ({ ...previous, active: event.target.checked }))} /> Coupon is active</label>
                                </div>
                                <button className="primary-button admin-product-submit" type="submit" disabled={couponSaving}>{couponSaving ? <LoaderCircle size={16} className="spin-icon" /> : <Save size={16} />}{editingCouponId ? 'Save changes' : 'Create coupon'}</button>
                              </form>
                              <div className="admin-products-list-heading admin-coupons-heading"><div><h2>Coupons</h2><p>{coupons.length} offer{coupons.length === 1 ? '' : 's'} in your promotion list.</p></div></div>
                              {couponsLoading && !coupons.length ? <div className="orders-state"><LoaderCircle className="spin-icon" size={22} /> Loading coupons…</div> : coupons.length ? (
                                <div className="admin-coupon-list">
                                  {coupons.map((coupon) => {
                                    const expired = coupon.expiresAt && new Date(coupon.expiresAt) <= new Date();
                                    const exhausted = coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit;
                                    const isAvailable = coupon.active && !expired && !exhausted && (!coupon.startsAt || new Date(coupon.startsAt) <= new Date());
                                    return <article className="admin-coupon-row" key={coupon._id}>
                                      <span className="admin-coupon-icon"><Tag size={18} /></span>
                                      <div className="admin-coupon-main"><strong>{coupon.code}</strong><span>{coupon.type === 'percentage' ? `${coupon.value}% off` : `${peso(coupon.value)} off`}{coupon.minimumSubtotal ? ` · min. spend ${peso(coupon.minimumSubtotal)}` : ''}</span></div>
                                      <div className="admin-coupon-meta"><span>{coupon.usageCount || 0}{coupon.usageLimit == null ? ' uses' : ` / ${coupon.usageLimit} uses`}</span><small className={isAvailable ? 'coupon-status active' : 'coupon-status'}>{isAvailable ? 'Active' : expired ? 'Expired' : exhausted ? 'Limit reached' : coupon.active ? 'Scheduled' : 'Paused'}</small></div>
                                      <div className="admin-product-actions"><button type="button" className="secondary-button" onClick={() => editCoupon(coupon)}>Edit</button><button type="button" className="admin-delete-button" onClick={() => deleteCoupon(coupon)}>Delete</button></div>
                                    </article>;
                                  })}
                                </div>
                              ) : <div className="admin-inventory-empty"><Tag size={22} /><strong>No coupons yet</strong><span>Create your first promo code above to offer customers a checkout discount.</span></div>}
                            </section>
                          ) : (
                            <section className="admin-users-workspace" aria-label="Registered users">
                              <div className="admin-users-toolbar">
                                <div><strong>{adminUsersPagination.total}</strong><span>registered account{adminUsersPagination.total === 1 ? '' : 's'}</span></div>
                                <label className="admin-users-search"><Search size={16} /><input value={adminUsersQuery} onChange={(event) => { setAdminUsersQuery(event.target.value); setAdminUsersPage(1); }} placeholder="Search name or email" aria-label="Search users" /></label>
                              </div>
                              {adminUsersLoading && !adminUsers.length ? <div className="orders-state"><LoaderCircle className="spin-icon" size={22} /> Loading registered users…</div>
                                : adminUsersError ? <div className="orders-state orders-error" role="alert"><p>{adminUsersError}</p><button type="button" className="secondary-button" onClick={loadAdminUsers}>Try again</button></div>
                                  : adminUsers.length ? (
                                    <>
                                      <div className="admin-users-list-head"><span>ACCOUNT</span><span>PHONE</span><span>JOINED</span><span>ACCESS</span></div>
                                      <div className="admin-users-list">
                                        {adminUsers.map((account) => (
                                          <article className="admin-user-row" key={account._id}>
                                            <div className="admin-user-identity"><span className="admin-user-avatar">{`${account.firstName || ''} ${account.lastName || ''}`.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || <UserRound size={16} />}</span><div><strong>{`${account.firstName || ''} ${account.lastName || ''}`.trim() || 'Unnamed user'}</strong><span>{account.email}</span></div></div>
                                            <span className="admin-user-phone">{account.phone || 'Not provided'}</span>
                                            <span className="admin-user-joined">{account.createdAt ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(account.createdAt)) : '—'}</span>
                                            <div className="admin-user-access"><span className={`admin-user-role ${account.role === 'admin' ? 'is-admin' : ''}`}>{account.role === 'admin' ? 'Admin' : 'Customer'}</span><span className={`admin-user-active ${account.isActive ? 'is-active' : ''}`}>{account.isActive ? 'Active' : 'Inactive'}</span></div>
                                          </article>
                                        ))}
                                      </div>
                                      {adminUsersPagination.pages > 1 && <div className="admin-users-pagination"><span>Page {adminUsersPage} of {adminUsersPagination.pages}</span><div><button className="secondary-button" type="button" onClick={() => setAdminUsersPage((current) => Math.max(1, current - 1))} disabled={adminUsersPage <= 1}>Previous</button><button className="secondary-button" type="button" onClick={() => setAdminUsersPage((current) => Math.min(adminUsersPagination.pages, current + 1))} disabled={adminUsersPage >= adminUsersPagination.pages}>Next</button></div></div>}
                                    </>
                                  ) : <div className="admin-inventory-empty"><UserRound size={22} /><strong>No registered users found</strong><span>{adminUsersQuery ? 'Try a different name or email.' : 'New customer accounts will appear here.'}</span></div>}
                            </section>
                          )}
                      </>
                  )}
              </section>
              <section className="orders-page" aria-labelledby="orders-title">
                  <div className="orders-page-heading">
                      <div>
                          <div className="eyebrow"><span className="eyebrow-line"></span> YOUR SKYSHOP ACCOUNT</div>
                          <h1 id="orders-title">My <em>orders.</em></h1>
                          <p>See what’s on its way and check the latest status of your purchases.</p>
                      </div>
                      <button className="secondary-button orders-refresh" type="button" onClick={loadOrders} disabled={ordersLoading}>
                          <RefreshCw size={16} className={ordersLoading ? 'spin-icon' : ''} />
                          Refresh
                      </button>
                  </div>
                  <div className="order-filters" role="tablist" aria-label="Filter orders">
                      {[
                        ['all', 'All orders'],
                        ['active', 'In progress'],
                        ['delivered', 'Delivered'],
                        ['cancelled', 'Cancelled'],
                      ].map(([value, label]) => (
                          <button key={value} type="button" role="tab" aria-selected={ordersFilter === value} className={ordersFilter === value ? 'order-filter active' : 'order-filter'} onClick={() => setOrdersFilter(value)}>
                              {label}
                          </button>
                      ))}
                  </div>
                  {!token ? (
                      <div className="orders-empty">
                          <span className="orders-empty-icon"><UserRound size={24} /></span>
                          <h2>Sign in to view your orders.</h2>
                          <p>Your order history is connected to your SkyShop account.</p>
                          <button className="primary-button" type="button" onClick={openAccount}>Sign in <ArrowRight size={16} /></button>
                      </div>
                  ) : ordersLoading && !orders.length ? (
                      <div className="orders-state"><LoaderCircle className="spin-icon" size={22} /> Loading your orders…</div>
                  ) : ordersError ? (
                      <div className="orders-state orders-error" role="alert">
                          <p>{ordersError}</p>
                          <button type="button" className="secondary-button" onClick={loadOrders}>Try again</button>
                      </div>
                  ) : visibleOrders.length === 0 ? (
                      <div className="orders-empty">
                          <span className="orders-empty-icon"><Package size={24} /></span>
                          <h2>{orders.length ? 'No orders in this section yet.' : 'Your next favorite is waiting.'}</h2>
                          <p>{orders.length ? 'Try another filter to see your order history.' : 'Once you place an order, its status and details will show up here.'}</p>
                          {!orders.length && <button className="primary-button" type="button" onClick={() => { setOrdersOpen(false); goProducts(); }}>Explore the collection <ArrowRight size={16} /></button>}
                      </div>
                  ) : (
                      <div className="orders-list">
                          {visibleOrders.map((order) => {
                            const statusIndex = orderStatusSteps.indexOf(order.status);
                            const fullAddress = [order.shippingAddress?.addressLine1, order.shippingAddress?.addressLine2, order.shippingAddress?.city, order.shippingAddress?.province, order.shippingAddress?.postalCode, order.shippingAddress?.country].filter(Boolean).join(', ');
                            return (
                              <article className="order-card" key={order._id}>
                                  <div className="order-card-header">
                                      <div>
                                          <span className="order-number-label">ORDER</span>
                                          <h2>#{String(order._id).slice(-8).toUpperCase()}</h2>
                                      </div>
                                      <span className={`order-status status-${order.status}`}>{orderStatusLabel(order.status)}</span>
                                  </div>
                                  <div className="order-meta">
                                      <span><CalendarDays size={15} /> {order.createdAt ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(order.createdAt)) : 'Date unavailable'}</span>
                                      <span>{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}</span>
                                      <strong>{peso(order.total)}</strong>
                                  </div>
                                  {order.status === 'cancelled' ? (
                                      <div className="order-cancelled-note">This order was cancelled.</div>
                                  ) : (
                                      <div className="order-tracking" aria-label={`Order status: ${orderStatusLabel(order.status)}`}>
                                          {orderStatusSteps.map((step, index) => (
                                              <div key={step} className={`tracking-step ${statusIndex >= index ? 'is-complete' : ''} ${statusIndex === index ? 'is-current' : ''}`}>
                                                  <span className="tracking-dot">{statusIndex > index ? <Check size={12} /> : null}</span>
                                                  <span>{orderStatusLabel(step)}</span>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  <div className="order-items">
                                      {(order.items || []).map((item, index) => (
                                          <div className="order-item" key={`${order._id}-${index}`}>
                                              <img src={resolveProductImage(item.image || item.productId?.image, item.name)} alt={item.name} />
                                              <div className="order-item-copy"><strong>{item.name}</strong><small>Qty {item.quantity}</small>{order.status === 'delivered' && item.productId && (() => { const productId = typeof item.productId === 'object' ? item.productId?._id : item.productId; const existingReview = myReviews[reviewKey(order._id, productId)]; return <button type="button" className="order-review-button" onClick={() => openReviewForm(order, item)}><Star size={13} fill={existingReview ? 'currentColor' : 'none'} />{existingReview ? 'Edit review' : 'Write a review'}</button>; })()}</div>
                                              <b>{peso(item.price * item.quantity)}</b>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="order-card-footer">
                                      <span><MapPin size={15} /> {fullAddress || 'Shipping address unavailable'}</span>
                                      <span>{order.paymentMethod === 'cash_on_delivery' ? 'Cash on delivery' : order.paymentMethod === 'bank_transfer' ? 'Bank transfer' : 'E-wallet'}</span>
                                      {['pending', 'processing'].includes(order.status) && <button type="button" className="order-cancel-button" onClick={() => setCancelOrderTarget(order)}><X size={14} />Cancel order</button>}
                                  </div>
                              </article>
                            );
                          })}
                      </div>
                  )}
              </section>
              <section className="vouchers-page" aria-labelledby="vouchers-title">
                  <div className="vouchers-heading">
                      <span className="eyebrow"><span className="eyebrow-line" /> A LITTLE THANK-YOU</span>
                      <h1 id="vouchers-title">Good finds, <em>better deals.</em></h1>
                      <p>Browse active voucher codes and enter one at checkout to save on your order.</p>
                  </div>
                  {availableCouponsLoading ? (
                    <div className="vouchers-state"><LoaderCircle size={22} className="spin-icon" /> Finding your available offers…</div>
                  ) : availableCouponsError ? (
                    <div className="vouchers-state vouchers-error" role="alert"><p>{availableCouponsError}</p><button className="secondary-button" type="button" onClick={loadAvailableCoupons}>Try again</button></div>
                  ) : availableCoupons.length ? (
                    <div className="voucher-grid">
                      {availableCoupons.map((coupon) => (
                        <article className="voucher-card" key={coupon._id}>
                          <div className="voucher-card-top"><span className="voucher-icon"><Tag size={18} /></span><span>AVAILABLE NOW</span></div>
                          <strong className="voucher-value">{coupon.type === 'percentage' ? `${coupon.value}% off` : `${peso(coupon.value)} off`}</strong>
                          <p className="voucher-description">{coupon.minimumSubtotal ? `On orders of ${peso(coupon.minimumSubtotal)} or more` : 'A little something off your order'}{coupon.type === 'percentage' && coupon.maxDiscount != null ? ` · up to ${peso(coupon.maxDiscount)}` : ''}</p>
                          <div className="voucher-code-row"><span>{coupon.code}</span><button type="button" onClick={() => copyVoucherCode(coupon.code)}>Copy code</button></div>
                          {coupon.expiresAt && <small className="voucher-expiry">Valid until {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(coupon.expiresAt))}</small>}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="vouchers-empty"><span className="voucher-icon"><Tag size={21} /></span><h2>No vouchers available right now</h2><p>Check back soon for a little extra off your next favorite.</p><button type="button" className="primary-button" onClick={() => navigatePage('shop')}>Explore the collection <ArrowRight size={16} /></button></div>
                  )}
              </section>
              <section className="hero-wrap">
                  <div className="hero-copy">
                      <div className="eyebrow">
                          <span className="eyebrow-line"></span> GOOD FINDS,
                          GOOD FEELS
                      </div>
                      <h1>
                          Little things.
                          <br />
                          <em>Lovely finds.</em>
                      </h1>
                      <p className="hero-description">
                          Thoughtful everyday essentials that bring a little
                          more joy to your every day. Go on, find your new
                          favorite.
                      </p>
                      <div className="hero-actions">
                          <button
                              className="primary-button"
                              onClick={goProducts}
                          >
                              Explore the collection <ArrowRight size={17} />
                          </button>
                          <div className="social-proof">
                              <div className="avatar-stack">
                                  <span>J</span>
                                  <span>M</span>
                                  <span>A</span>
                              </div>
                              <div>
                                  <div className="proof-stars">★★★★★</div>
                                  <small>Loved by 2,400+ happy shoppers</small>
                              </div>
                          </div>
                      </div>
                      <div className="hero-footnote">
                          <span className="footnote-icon">
                              <Truck size={16} />
                          </span>{" "}
                          Made for everyday. Picked with care.
                      </div>
                  </div>
                  <div className="hero-art">
                      <div className="hero-sun"></div>
                      <div className="hero-sticker sticker-top">
                          a little
                          <br />
                          something <span>♡</span>
                      </div>
                      <div className="hero-photo">
                          <img
                              className="hero-cloud-image"
                              src={localImage("hero")}
                              alt=""
                          />
                          <div className="photo-label">
                              <span className="photo-label-dot"></span> THE
                              EVERYDAY EDIT <span>01 / 04</span>
                          </div>
                      </div>
                      <div className="hero-sticker sticker-bottom">
                          <span className="sparkle-doodle">✳</span>
                          <span>
                              Good things
                              <br />
                              are here.
                          </span>
                      </div>
                      <div className="hero-orbit"></div>
                  </div>
              </section>
              <section className="benefit-strip">
                  <div>
                      <span className="benefit-icon">
                          <Truck size={18} />
                      </span>
                      <span>
                          <b>Free shipping</b>
                          <small>On orders ₱1,500+</small>
                      </span>
                  </div>
                  <div>
                      <span className="benefit-icon">
                          <ShieldCheck size={18} />
                      </span>
                      <span>
                          <b>Easy, secure checkout</b>
                          <small>Shop with peace of mind</small>
                      </span>
                  </div>
                  <div>
                      <span className="benefit-icon">
                          <Package size={18} />
                      </span>
                      <span>
                          <b>Packed with care</b>
                          <small>A little joy, delivered</small>
                      </span>
                  </div>
                  <div>
                      <span className="benefit-icon">
                          <Headphones size={18} />
                      </span>
                      <span>
                          <b>Here to help</b>
                          <small>Real people, kind answers</small>
                      </span>
                  </div>
              </section>

              <section className="shop-section" id="shop">
                  <div className="section-heading">
                      <div>
                          <div className="eyebrow">
                              <span className="eyebrow-line"></span> YOUR NEXT
                              FAVORITE
                          </div>
                          <h2>
                              {page === 'fashion' ? <>Everyday <em>style.</em></> : page === 'living' ? <>A happier <em>home.</em></> : page === 'accessories' ? <>Little <em>extras.</em></> : page === 'tech' ? <>Everyday <em>tech.</em></> : page === 'new-arrivals' ? <>Fresh <em>finds.</em></> : <>Good things, <em>right this way.</em></>}
                          </h2>
                          <p>{page === 'fashion' ? 'Easy favorites, made to wear and love.' : page === 'living' ? 'Little upgrades for the spaces you call home.' : page === 'accessories' ? 'The finishing touches for your everyday.' : page === 'tech' ? 'Useful tech picks for work, rest, and play.' : page === 'new-arrivals' ? 'The latest finds, freshly added to the store.' : 'Little upgrades for your everyday routine.'}</p>
                      </div>
                      <a
                          className="text-link"
                          href="#/shop"
                          onClick={(event) => { event.preventDefault(); setSearch(""); navigatePage('shop'); }}
                      >
                          See everything <ArrowRight size={16} />
                      </a>
                  </div>
                  <div className="shop-toolbar">
                      <div className="category-pills">
                          {categories.map((item) => (
                              <button
                                  key={item}
                                  className={
                                      category === item
                                          ? "category-pill selected"
                                          : "category-pill"
                                  }
                                  onClick={() => {
                                    setCategory(item);
                                    setShopProductsPage(1);
                                    if (item === 'Fashion') navigatePage('fashion');
                                    else if (item === 'Accessories') navigatePage('accessories');
                                    else if (item === 'Tech') navigatePage('tech');
                                    else if (item === 'Home') navigatePage('living');
                                    else if (item === 'All') navigatePage('shop');
                                  }}
                              >
                                  {item}
                              </button>
                          ))}
                      </div>
                      <label className="sort-select">
                          <SlidersHorizontal size={15} />
                          <select
                              value={page === 'new-arrivals' ? 'newest' : sort}
                              onChange={(event) => { setSort(event.target.value); setShopProductsPage(1); }}
                              aria-label="Sort products"
                          >
                              {page === 'new-arrivals' ? <option value="newest">Newest first</option> : <option value="featured">Featured</option>}
                              <option value="low">Price: low to high</option>
                              <option value="high">Price: high to low</option>
                              <option value="rating">Top rated</option>
                          </select>
                          <ChevronDown size={14} />
                      </label>
                  </div>
                  {catalogLoading && (
                      <div className="api-loading">
                          <LoaderCircle size={17} className="spin-icon" />{" "}
                          Loading products from SkyShop server…
                      </div>
                  )}
                  {catalogSource === "error" && !catalogLoading && (
                      <div className="api-fallback" role="alert">
                          Unable to load products from the server.
                          <button onClick={reloadProducts}>Try again</button>
                          <small>{catalogError}</small>
                      </div>
                  )}
                  {catalogSource === "api"
                      ? "Server connected"
                      : catalogSource === "loading"
                        ? "Connecting to server…"
                        : "Server offline"}
                  <div className="product-grid" id="product-grid">
                      {paginatedProducts.map((product) => (
                          <article className="product-card product-card-clickable" key={product._id} tabIndex={0} onClick={() => openProductDetails(product)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openProductDetails(product); } }} aria-label={`View details for ${product.name}`}>
                              <div
                                  className="product-image-wrap"
                                  style={{
                                      background: product.bg || "#e2efff",
                                  }}
                              >
                                  <img
                                      src={product.image || placeholderImage}
                                      alt={product.name}
                                      loading="lazy"
                                  />
                                  <div className="product-tags">
                                      {product.tag && (
                                          <span className="product-tag">
                                              {product.tag}
                                          </span>
                                      )}
                                      {product.oldPrice && (
                                          <span className="sale-tag">SALE</span>
                                      )}
                                  </div>
                                  <button
                                      className={
                                          wishlist.includes(product._id)
                                              ? "wish-button wished"
                                              : "wish-button"
                                      }
                                      onClick={(event) => { event.stopPropagation(); toggleWish(product._id); }}
                                      aria-label={
                                          wishlist.includes(product._id)
                                              ? "Remove from wishlist"
                                              : "Add to wishlist"
                                      }
                                  >
                                      <Heart
                                          size={17}
                                          fill={
                                              wishlist.includes(product._id)
                                                  ? "currentColor"
                                                  : "none"
                                          }
                                      />
                                  </button>
                              </div>
                              <div className="product-details">
                                  <div className="product-category">
                                      {product.category}
                                  </div>
                                  <div className="product-title-row">
                                      <h3>{product.name}</h3>
                                      <div className="rating">
                                          {Number(product.reviews) > 0 ? <><Star size={12} fill="currentColor" /> {Number(product.rating).toFixed(1)}</> : <span className="rating-new">New</span>}
                                      </div>
                                  </div>
                                  <p className="product-description">
                                      {product.description}
                                  </p>
                                  <div className="price-row">
                                      <span className="price">
                                          {peso(product.price)}
                                      </span>
                                      {product.oldPrice && (
                                          <span className="old-price">
                                              {peso(product.oldPrice)}
                                          </span>
                                      )}
                                  </div>
                                  <small className="stock-note">
                                      {product.stock > 0
                                          ? `${product.stock} in stock`
                                          : "Currently unavailable"}
                                  </small>
                                  <div className="product-card-actions">
                                      <button type="button" className="product-card-action-button add-to-bag" disabled={product.stock <= 0} onClick={(event) => { event.stopPropagation(); addToCart(product); }}><ShoppingBag size={14} />Add to bag</button>
                                      <button type="button" className="product-card-action-button buy-now" disabled={product.stock <= 0} onClick={(event) => { event.stopPropagation(); buyNow(product); }}><ArrowRight size={14} />Buy now</button>
                                  </div>
                              </div>
                          </article>
                      ))}
                  </div>
                  {!catalogLoading &&
                      visibleProducts.length === 0 &&
                      catalogSource !== "api" && (
                          <div className="empty-state">
                              <span>☁</span>
                              <h3>No finds just yet</h3>
                              <p>
                                  Try another search or category. Your next
                                  favorite is out there.
                              </p>
                              <button
                                  className="primary-button"
                                  onClick={() => {
                                      setSearch("");
                                      setCategory("All");
                                      setShopProductsPage(1);
                                  }}
                              >
                                  Clear filters <ArrowRight size={16} />
                              </button>
                          </div>
                      )}
                  {!catalogLoading &&
                      catalogSource === "api" &&
                      products.length > 0 &&
                      visibleProducts.length === 0 && (
                          <div className="empty-state">
                              <span>☁</span>
                              <h3>No matching finds</h3>
                              <p>Try another search or category.</p>
                              <button
                                  className="primary-button"
                                  onClick={() => {
                                      setSearch("");
                                      setCategory("All");
                                      setShopProductsPage(1);
                                  }}
                              >
                                  Clear filters <ArrowRight size={16} />
                              </button>
                          </div>
                      )}
                  {!catalogLoading && visibleProducts.length > shopProductsPageSize && <nav className="store-pagination" aria-label="Product pages"><span>Showing {(currentShopProductsPage - 1) * shopProductsPageSize + 1}–{Math.min(currentShopProductsPage * shopProductsPageSize, visibleProducts.length)} of {visibleProducts.length} products</span><div><button type="button" className="secondary-button" onClick={() => changeShopProductsPage(currentShopProductsPage - 1)} disabled={currentShopProductsPage <= 1}>Previous</button><span className="store-pagination-page">Page {currentShopProductsPage} of {shopProductsPageCount}</span><button type="button" className="secondary-button" onClick={() => changeShopProductsPage(currentShopProductsPage + 1)} disabled={currentShopProductsPage >= shopProductsPageCount}>Next</button></div></nav>}
                  <div className="collection-note">
                      <span className="note-star">✳</span>
                      <span>
                          <b>Good taste. No guesswork.</b>
                          <small>
                              Small-batch finds and everyday favorites, all in
                              one happy place.
                          </small>
                      </span>
                      <button
                          onClick={() => navigatePage('story')}
                      >
                          A little more about us <ArrowRight size={15} />
                      </button>
                  </div>
              </section>
              <section className="story-section" id="story">
                  <div className="story-visual">
                      <span className="story-bubble">
                          picked
                          <br />
                          with ♡
                      </span>
                  </div>
                  <div className="story-copy">
                      <div className="eyebrow">
                          <span className="eyebrow-line"></span> OUR STORY
                      </div>
                      <h2>
                          A little joy,
                          <br />
                          <em>thoughtfully chosen.</em>
                      </h2>
                      <p>
                          SkyShop began with a simple thought: everyday things
                          deserve a little more care. The pieces we use, wear,
                          and keep around us can make an ordinary day feel
                          brighter.
                      </p>
                      <p>
                          So we bring useful, lovely finds together in one
                          easy place—from personal style and home comforts to
                          handy little tech. We look for things that feel good
                          to use and easy to make your own.
                      </p>
                      <p>Good finds, clear choices, and a little joy in every order. That’s the kind of shopping we want SkyShop to be.</p>
                      <button
                          className="secondary-button"
                          onClick={() => navigatePage('shop')}
                      >
                          Explore our finds <ArrowRight size={16} />
                      </button>
                  </div>
              </section>
              <section className="story-values-section" aria-labelledby="story-values-title">
                  <div className="story-values-heading"><span className="eyebrow"><span className="eyebrow-line" /> THE SKYSHOP WAY</span><h2 id="story-values-title">Thoughtful in the little things.</h2><p>Every part of the experience should feel simple, useful, and cared for.</p></div>
                  <div className="story-values-grid">
                      <article><span>01</span><h3>Useful by nature</h3><p>Everyday favorites that have a place in your routine, not just on a shelf.</p></article>
                      <article><span>02</span><h3>Easy to choose</h3><p>A considered mix of style, home, and tech finds in one friendly shop.</p></article>
                      <article><span>03</span><h3>Packed with care</h3><p>From browsing to delivery, we want the small details to feel just right.</p></article>
                  </div>
              </section>
              <section className="newsletter">
                  <div className="newsletter-spark">✳</div>
                  <div>
                      <div className="eyebrow">A LITTLE NOTE IN YOUR INBOX</div>
                      <h2>
                          Good things come to <em>those who subscribe.</em>
                      </h2>
                      <p>
                          Fresh finds, little perks, and the occasional happy
                          surprise.
                      </p>
                  </div>
                  <form
                      onSubmit={(event) => {
                          event.preventDefault();
                          showNotice(
                              "Newsletter subscription is a frontend demo for now.",
                          );
                          event.currentTarget.reset();
                      }}
                  >
                      <input
                          type="email"
                          placeholder="Your email address"
                          aria-label="Email address"
                          required
                      />
                      <button type="submit" aria-label="Subscribe">
                          <ArrowRight size={19} />
                      </button>
                  </form>
              </section>
              <section className="settings-page" aria-labelledby="settings-title">
                  <div className="settings-page-heading"><span className="eyebrow"><span className="eyebrow-line" /> YOUR SKYSHOP ACCOUNT</span><h1 id="settings-title">Account <em>settings.</em></h1><p>Manage your profile, password, and display preferences.</p></div>
                  {!user ? (
                      <div className="settings-signin"><h2>Sign in to manage your settings.</h2><p>Your saved details make future checkouts faster.</p><button className="primary-button" type="button" onClick={openAccount}>Sign in <ArrowRight size={16} /></button></div>
                  ) : (
                      <div className="settings-layout">
                          <aside className="settings-sidebar">
                              <div className="settings-account-summary"><span className="signed-user-icon"><UserRound size={24} /></span><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div>
                              <nav className="settings-menu" aria-label="Settings sections">
                                  <button type="button" className={accountSection === 'profile' ? 'active' : ''} onClick={() => setAccountSection('profile')}><UserRound size={17} />Personal information</button>
                                  <button type="button" className={accountSection === 'password' ? 'active' : ''} onClick={() => setAccountSection('password')}><LockKeyhole size={17} />Change password</button>
                                  <button type="button" className={accountSection === 'preferences' ? 'active' : ''} onClick={() => setAccountSection('preferences')}><SlidersHorizontal size={17} />Preferences</button>
                              </nav>
                              <button className="secondary-button settings-signout" type="button" onClick={requestSignOut}><LogOut size={16} />Sign out</button>
                          </aside>
                          <div className="settings-panel">
                              {accountSection === 'profile' ? (
                                  <form className="settings-form" onSubmit={saveAccountProfile}>
                                      <div className="settings-panel-heading"><div><h2>Personal information</h2><p>Saved details will be filled in automatically when you check out.</p></div><span className="settings-panel-icon"><UserRound size={20} /></span></div>
                                      <div className="settings-fields">
                                          <label>First name<input autoComplete="given-name" required maxLength={80} value={profileForm.firstName} onChange={(event) => setProfileForm((previous) => ({ ...previous, firstName: event.target.value }))} /></label>
                                          <label>Last name<input autoComplete="family-name" required maxLength={80} value={profileForm.lastName} onChange={(event) => setProfileForm((previous) => ({ ...previous, lastName: event.target.value }))} /></label>
                                          <label className="settings-field-wide">Email address<input type="email" autoComplete="email" required maxLength={254} value={profileForm.email} onChange={(event) => setProfileForm((previous) => ({ ...previous, email: event.target.value }))} /></label>
                                          <label className="settings-field-wide">Phone number <span className="optional-label">(optional)</span><input autoComplete="tel" maxLength={30} value={profileForm.phone} onChange={(event) => setProfileForm((previous) => ({ ...previous, phone: event.target.value }))} /></label>
                                      </div>
                                      <div className="settings-address-heading"><div><h3>Default delivery address</h3><p>Use this address automatically for your next order.</p></div><MapPin size={19} /></div>
                                      <div className="settings-fields">
                                          <label className="settings-field-wide">Address line 1<input autoComplete="address-line1" maxLength={200} value={profileForm.addressLine1} onChange={(event) => setProfileForm((previous) => ({ ...previous, addressLine1: event.target.value }))} placeholder="House no., street, barangay" /></label>
                                          <label className="settings-field-wide">Address line 2 <span className="optional-label">(optional)</span><input autoComplete="address-line2" maxLength={200} value={profileForm.addressLine2} onChange={(event) => setProfileForm((previous) => ({ ...previous, addressLine2: event.target.value }))} placeholder="Apartment, unit, building" /></label>
                                          <label>City<input autoComplete="address-level2" maxLength={100} value={profileForm.city} onChange={(event) => setProfileForm((previous) => ({ ...previous, city: event.target.value }))} /></label>
                                          <label>Province<input autoComplete="address-level1" maxLength={100} value={profileForm.province} onChange={(event) => setProfileForm((previous) => ({ ...previous, province: event.target.value }))} /></label>
                                          <label>Postal code<input autoComplete="postal-code" maxLength={20} value={profileForm.postalCode} onChange={(event) => setProfileForm((previous) => ({ ...previous, postalCode: event.target.value }))} /></label>
                                          <label>Country<input autoComplete="country-name" maxLength={100} value={profileForm.country} onChange={(event) => setProfileForm((previous) => ({ ...previous, country: event.target.value }))} /></label>
                                      </div>
                                      <div className="settings-form-footer"><span>Your changes are saved to your SkyShop account.</span><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? <LoaderCircle size={17} className="spin-icon" /> : <Save size={16} />}{profileSaving ? 'Saving…' : 'Save changes'}</button></div>
                                  </form>
                              ) : accountSection === 'password' ? (
                                  <form className="settings-form settings-password-form" onSubmit={changeAccountPassword}>
                                      <div className="settings-panel-heading"><div><h2>Change password</h2><p>Choose a new password to keep your account secure.</p></div><span className="settings-panel-icon"><LockKeyhole size={20} /></span></div>
                                      <div className="settings-password-fields">
                                          <label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))} /></label>
                                          <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))} /><small>Use at least 8 characters.</small></label>
                                          <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} /></label>
                                      </div>
                                      <div className="settings-form-footer"><span>Your password is encrypted before it is saved.</span><button className="primary-button" type="submit" disabled={passwordSaving}>{passwordSaving ? <LoaderCircle size={17} className="spin-icon" /> : <LockKeyhole size={16} />}{passwordSaving ? 'Changing…' : 'Update password'}</button></div>
                                  </form>
                              ) : (
                                  <div className="settings-form settings-preferences-form">
                                      <div className="settings-panel-heading"><div><h2>Preferences</h2><p>Personalize your SkyShop experience.</p></div><span className="settings-panel-icon"><SlidersHorizontal size={20} /></span></div>
                                      <section className="settings-preference-card">
                                          <span className="settings-preference-icon">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</span>
                                          <div><strong>Dark mode</strong><p>{theme === 'dark' ? 'A darker look that is easier on the eyes.' : 'Switch to a darker look whenever you want.'}</p></div>
                                          <button type="button" role="switch" aria-checked={theme === 'dark'} className={theme === 'dark' ? 'settings-theme-switch is-on' : 'settings-theme-switch'} onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}><span /></button>
                                      </section>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
              </section>
              <section className="wishlist-page" aria-labelledby="wishlist-title">
                  <div className="settings-page-heading"><span className="eyebrow"><span className="eyebrow-line" /> YOUR SAVED FINDS</span><h1 id="wishlist-title">My <em>wishlist.</em></h1><p>{savedProducts.length ? `${savedProducts.length} saved item${savedProducts.length === 1 ? '' : 's'} for later.` : 'Keep the things you love close.'}</p></div>
                  <div className="wishlist-page-content">
                      {savedProducts.length ? <div className="wishlist-page-list">{savedProducts.map((product) => <article className="settings-wishlist-item" key={product._id}>
                          <button type="button" className="settings-wishlist-product" onClick={() => openProductDetails(product)}><img src={product.image || placeholderImage} alt="" /><span><strong>{product.name}</strong><small>{product.category} · {peso(product.price)}</small></span></button>
                          <button type="button" className="settings-wishlist-remove" onClick={() => toggleWish(product._id)} aria-label={`Remove ${product.name} from wishlist`}><X size={17} /></button>
                      </article>)}</div> : <div className="settings-wishlist-empty"><Heart size={24} /><span>Your wishlist is empty. Save products with the heart icon while browsing.</span><button type="button" className="secondary-button" onClick={() => navigatePage('shop')}>Browse products <ArrowRight size={15} /></button></div>}
                  </div>
              </section>
          </main>
          <footer className="site-footer">
              <a className="brand" href="#top" onClick={() => { setOrdersOpen(false); setPage('landing'); }}>
                  <span className="brand-mark">
                      <span></span>
                      <span></span>
                      <span></span>
                  </span>
                  <span>
                      skyshop<span className="brand-period">.</span>
                  </span>
              </a>
              <span>Little things, lovely finds. © 2026 SkyShop.</span>
              <div>
                  <a href="#/shop" onClick={() => { setOrdersOpen(false); setPage('shop'); }}>Shop</a>
                  <a href="#/story" onClick={() => { setOrdersOpen(false); setPage('story'); }}>Our story</a>
                  <a href="mailto:hello@skyshop.example">Contact</a>
              </div>
          </footer>

          {notice && (
              <div className="toast" role="status">
                  <span className="toast-check">
                      <Check size={15} />
                  </span>
                  {notice}
                  <button
                      onClick={() => setNotice("")}
                      aria-label="Dismiss notification"
                  >
                      <X size={15} />
                  </button>
              </div>
          )}

          {logoutConfirmOpen && (
              <div className="modal-backdrop logout-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutConfirmOpen(false); }}>
                  <section className="form-modal logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
                      <span className="logout-confirm-icon"><LogOut size={22} /></span>
                      <h2 id="logout-confirm-title">Log out of SkyShop?</h2>
                      <p>You can sign in again anytime to access your account and orders.</p>
                      <div><button className="secondary-button" type="button" onClick={() => setLogoutConfirmOpen(false)}>Stay signed in</button><button className="logout-confirm-action" type="button" onClick={signOut}>Log out</button></div>
                  </section>
              </div>
          )}

          {cancelOrderTarget && (
              <div className="modal-backdrop order-cancel-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && cancellingOrderId !== cancelOrderTarget._id) setCancelOrderTarget(null); }}>
                  <section className="form-modal logout-confirm-modal order-cancel-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
                      <span className="order-cancel-confirm-icon"><X size={22} /></span>
                      <span className="eyebrow">ORDER #{String(cancelOrderTarget._id).slice(-8).toUpperCase()}</span>
                      <h2 id="cancel-order-title">Cancel this order?</h2>
                      <p>Your order will be cancelled and its items returned to stock. You can’t undo this action.</p>
                      <div><button className="secondary-button" type="button" disabled={cancellingOrderId === cancelOrderTarget._id} onClick={() => setCancelOrderTarget(null)}>Keep order</button><button className="logout-confirm-action" type="button" disabled={cancellingOrderId === cancelOrderTarget._id} onClick={() => cancelCustomerOrder(cancelOrderTarget)}>{cancellingOrderId === cancelOrderTarget._id ? <><LoaderCircle size={16} className="spin-icon" /> Cancelling…</> : 'Yes, cancel order'}</button></div>
                  </section>
              </div>
          )}

          {accountOpen && (
              <div
                  className="modal-backdrop"
                  onClick={() => setAccountOpen(false)}
              >
                  <section
                      className="form-modal account-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="account-title"
                      onClick={(event) => event.stopPropagation()}
                  >
                      <div className="modal-heading">
                          <div>
                              <span className="eyebrow">
                                  YOUR SKYSHOP ACCOUNT
                              </span>
                              <h2 id="account-title">
                                  {user
                                      ? `Hello, ${user.firstName}!`
                                      : authMode === "login"
                                        ? "Welcome back."
                                        : "Join the good finds."}
                              </h2>
                              <p>
                                  {user
                                      ? "Your account is connected to the SkyShop server."
                                      : authMode === "login"
                                        ? "Sign in to sync your bag and place an order."
                                        : "Create an account to save your cart and check out."}
                              </p>
                          </div>
                          <button
                              className="icon-button"
                              onClick={() => setAccountOpen(false)}
                              aria-label="Close account dialog"
                          >
                              <X size={20} />
                          </button>
                      </div>
                      {user ? (
                          <div className="signed-in-panel">
                              <div className="signed-user-icon">
                                  <UserRound size={25} />
                              </div>
                              <strong>
                                  {user.firstName} {user.lastName}
                              </strong>
                              <span>{user.email}</span>
                              <div className="account-settings-tabs" role="tablist" aria-label="Account settings">
                                  <button type="button" role="tab" aria-selected={accountSection === 'profile'} className={accountSection === 'profile' ? 'active' : ''} onClick={() => setAccountSection('profile')}>Personal information</button>
                                  <button type="button" role="tab" aria-selected={accountSection === 'password'} className={accountSection === 'password' ? 'active' : ''} onClick={() => setAccountSection('password')}>Change password</button>
                              </div>
                              {accountSection === 'profile' ? (
                                  <form className="modal-form account-settings-form" onSubmit={saveAccountProfile}>
                                      <div className="form-grid two-columns">
                                          <label>First name<input autoComplete="given-name" required maxLength={80} value={profileForm.firstName} onChange={(event) => setProfileForm((previous) => ({ ...previous, firstName: event.target.value }))} /></label>
                                          <label>Last name<input autoComplete="family-name" required maxLength={80} value={profileForm.lastName} onChange={(event) => setProfileForm((previous) => ({ ...previous, lastName: event.target.value }))} /></label>
                                      </div>
                                      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={profileForm.email} onChange={(event) => setProfileForm((previous) => ({ ...previous, email: event.target.value }))} /></label>
                                      <label>Phone number <span className="optional-label">(optional)</span><input autoComplete="tel" maxLength={30} value={profileForm.phone} onChange={(event) => setProfileForm((previous) => ({ ...previous, phone: event.target.value }))} /></label>
                                      <div className="account-address-heading"><strong>Default delivery address</strong><small>Saved here, then filled in automatically at checkout.</small></div>
                                      <label>Address line 1<input autoComplete="address-line1" maxLength={200} value={profileForm.addressLine1} onChange={(event) => setProfileForm((previous) => ({ ...previous, addressLine1: event.target.value }))} placeholder="House no., street, barangay" /></label>
                                      <label>Address line 2 <span className="optional-label">(optional)</span><input autoComplete="address-line2" maxLength={200} value={profileForm.addressLine2} onChange={(event) => setProfileForm((previous) => ({ ...previous, addressLine2: event.target.value }))} placeholder="Apartment, unit, building" /></label>
                                      <div className="form-grid two-columns">
                                          <label>City<input autoComplete="address-level2" maxLength={100} value={profileForm.city} onChange={(event) => setProfileForm((previous) => ({ ...previous, city: event.target.value }))} /></label>
                                          <label>Province<input autoComplete="address-level1" maxLength={100} value={profileForm.province} onChange={(event) => setProfileForm((previous) => ({ ...previous, province: event.target.value }))} /></label>
                                          <label>Postal code<input autoComplete="postal-code" maxLength={20} value={profileForm.postalCode} onChange={(event) => setProfileForm((previous) => ({ ...previous, postalCode: event.target.value }))} /></label>
                                          <label>Country<input autoComplete="country-name" maxLength={100} value={profileForm.country} onChange={(event) => setProfileForm((previous) => ({ ...previous, country: event.target.value }))} /></label>
                                      </div>
                                      <button className="primary-button modal-submit" type="submit" disabled={profileSaving}>{profileSaving ? <LoaderCircle size={17} className="spin-icon" /> : <Save size={16} />}{profileSaving ? 'Saving information…' : 'Save personal information'}</button>
                                  </form>
                              ) : (
                                  <form className="modal-form account-settings-form" onSubmit={changeAccountPassword}>
                                      <label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))} /></label>
                                      <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))} /><small>Use at least 8 characters.</small></label>
                                      <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} /></label>
                                      <button className="primary-button modal-submit" type="submit" disabled={passwordSaving}>{passwordSaving ? <LoaderCircle size={17} className="spin-icon" /> : <LockKeyhole size={16} />}{passwordSaving ? 'Changing password…' : 'Change password'}</button>
                                  </form>
                              )}
                              <button
                                  className="secondary-button account-signout"
                                  type="button"
                                  onClick={requestSignOut}
                              >
                                  <LogOut size={16} /> Sign out · {user.role}
                              </button>
                          </div>
                      ) : (
                          <form
                              className="modal-form"
                              onSubmit={handleAuthSubmit}
                          >
                              {authMode === "register" && (
                                  <div className="form-grid two-columns">
                                      <label>
                                          First name
                                          <input
                                              value={authForm.firstName}
                                              onChange={(event) =>
                                                  setAuthForm({
                                                      ...authForm,
                                                      firstName:
                                                          event.target.value,
                                                  })
                                              }
                                              autoComplete="given-name"
                                              required
                                              maxLength={80}
                                          />
                                      </label>
                                      <label>
                                          Last name
                                          <input
                                              value={authForm.lastName}
                                              onChange={(event) =>
                                                  setAuthForm({
                                                      ...authForm,
                                                      lastName:
                                                          event.target.value,
                                                  })
                                              }
                                              autoComplete="family-name"
                                              required
                                              maxLength={80}
                                          />
                                      </label>
                                  </div>
                              )}
                              <label>
                                  Email address
                                  <input
                                      type="email"
                                      value={authForm.email}
                                      onChange={(event) =>
                                          setAuthForm({
                                              ...authForm,
                                              email: event.target.value,
                                          })
                                      }
                                      autoComplete="email"
                                      required
                                      maxLength={254}
                                  />
                              </label>
                              {authMode === "register" && (
                                  <label>
                                      Phone number{" "}
                                      <span className="optional-label">
                                          (optional)
                                      </span>
                                      <input
                                          value={authForm.phone}
                                          onChange={(event) =>
                                              setAuthForm({
                                                  ...authForm,
                                                  phone: event.target.value,
                                              })
                                          }
                                          autoComplete="tel"
                                          maxLength={30}
                                      />
                                  </label>
                              )}
                              <label>
                                  Password
                                  <input
                                      type="password"
                                      value={authForm.password}
                                      onChange={(event) =>
                                          setAuthForm({
                                              ...authForm,
                                              password: event.target.value,
                                          })
                                      }
                                      autoComplete={
                                          authMode === "login"
                                              ? "current-password"
                                              : "new-password"
                                      }
                                      minLength={8}
                                      maxLength={128}
                                      required
                                  />
                                  <small>At least 8 characters.</small>
                              </label>
                              <button
                                  className="primary-button modal-submit"
                                  type="submit"
                                  disabled={authLoading}
                              >
                                  {authLoading ? (
                                      <LoaderCircle
                                          className="spin-icon"
                                          size={17}
                                      />
                                  ) : (
                                      <LockKeyhole size={16} />
                                  )}{" "}
                                  {authLoading
                                      ? "Please wait…"
                                      : authMode === "login"
                                        ? "Sign in"
                                        : "Create account"}
                              </button>
                              <p className="auth-toggle">
                                  {authMode === "login"
                                      ? "New to SkyShop?"
                                      : "Already have an account?"}{" "}
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setAuthMode(
                                              authMode === "login"
                                                  ? "register"
                                                  : "login",
                                          )
                                      }
                                  >
                                      {authMode === "login"
                                          ? "Create an account"
                                          : "Sign in"}
                                  </button>
                              </p>
                              {catalogSource !== "api" && (
                                  <p className="modal-warning">
                                      The backend is currently unavailable.
                                      Start the server before signing in.
                                  </p>
                              )}
                          </form>
                      )}
                  </section>
              </div>
          )}

          {checkoutOpen && (
              <div
                  className="modal-backdrop checkout-backdrop"
                  onClick={() => !checkoutLoading && closeCheckout()}
              >
                  <section
                      className="form-modal checkout-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="checkout-title"
                      onClick={(event) => event.stopPropagation()}
                  >
                      <div className="modal-heading">
                          <div>
                              <span className="eyebrow">ALMOST YOURS</span>
                              <h2 id="checkout-title">Delivery details</h2>
                              <p>
                                  Order total is calculated and inventory is
                                  checked by the server.
                              </p>
                          </div>
                          <button
                              className="icon-button"
                              onClick={closeCheckout}
                              disabled={checkoutLoading}
                              aria-label="Close checkout"
                          >
                              <X size={20} />
                          </button>
                      </div>
                      <form
                          className="modal-form"
                          onSubmit={handleCheckoutSubmit}
                      >
                          <div className="form-grid two-columns">
                              <label>
                                  Full name
                                  <input
                                      value={checkoutForm.name}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              name: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={160}
                                      autoComplete="name"
                                  />
                              </label>
                              <label>
                                  Email
                                  <input
                                      type="email"
                                      value={checkoutForm.email}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              email: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={254}
                                      autoComplete="email"
                                  />
                              </label>
                          </div>
                          <label>
                              Phone number
                              <input
                                  value={checkoutForm.phone}
                                  onChange={(event) =>
                                      setCheckoutForm({
                                          ...checkoutForm,
                                          phone: event.target.value,
                                      })
                                  }
                                  maxLength={30}
                                  autoComplete="tel"
                              />
                          </label>
                          <label>
                              Address line 1
                              <input
                                  value={checkoutForm.addressLine1}
                                  onChange={(event) =>
                                      setCheckoutForm({
                                          ...checkoutForm,
                                          addressLine1: event.target.value,
                                      })
                                  }
                                  required
                                  maxLength={200}
                                  autoComplete="address-line1"
                              />
                          </label>
                          <label>
                              Address line 2{" "}
                              <span className="optional-label">(optional)</span>
                              <input
                                  value={checkoutForm.addressLine2}
                                  onChange={(event) =>
                                      setCheckoutForm({
                                          ...checkoutForm,
                                          addressLine2: event.target.value,
                                      })
                                  }
                                  maxLength={200}
                                  autoComplete="address-line2"
                              />
                          </label>
                          <div className="form-grid two-columns">
                              <label>
                                  City
                                  <input
                                      value={checkoutForm.city}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              city: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={100}
                                      autoComplete="address-level2"
                                  />
                              </label>
                              <label>
                                  Province / region
                                  <input
                                      value={checkoutForm.province}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              province: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={100}
                                      autoComplete="address-level1"
                                  />
                              </label>
                          </div>
                          <div className="form-grid two-columns">
                              <label>
                                  Postal code
                                  <input
                                      value={checkoutForm.postalCode}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              postalCode: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={20}
                                      autoComplete="postal-code"
                                  />
                              </label>
                              <label>
                                  Country
                                  <input
                                      value={checkoutForm.country}
                                      onChange={(event) =>
                                          setCheckoutForm({
                                              ...checkoutForm,
                                              country: event.target.value,
                                          })
                                      }
                                      required
                                      maxLength={100}
                                      autoComplete="country-name"
                                  />
                              </label>
                          </div>
                          <label>
                              Payment method
                              <select
                                  value={checkoutForm.paymentMethod}
                                  onChange={(event) =>
                                      setCheckoutForm({
                                          ...checkoutForm,
                                          paymentMethod: event.target.value,
                                      })
                                  }
                              >
                                  <option value="cash_on_delivery">
                                      Cash on delivery
                                  </option>
                                  <option value="bank_transfer">
                                      Bank transfer
                                  </option>
                                  <option value="e_wallet">E-wallet</option>
                              </select>
                          </label>
                          <label>
                              Order notes{" "}
                              <span className="optional-label">(optional)</span>
                              <textarea
                                  value={checkoutForm.notes}
                                  onChange={(event) =>
                                      setCheckoutForm({
                                          ...checkoutForm,
                                          notes: event.target.value,
                                      })
                                  }
                                  rows={2}
                                  maxLength={1000}
                              />
                          </label>
                          <div className="checkout-coupon">
                              <label htmlFor="checkout-coupon-code">Coupon code</label>
                              <div className="checkout-coupon-entry">
                                  <input id="checkout-coupon-code" value={couponCodeInput} disabled={couponApplying} onChange={(event) => { setCouponCodeInput(event.target.value.toUpperCase()); setCouponError(''); setAppliedCoupon(null); }} placeholder="Enter promo code" maxLength={32} />
                                  {appliedCoupon ? <button type="button" className="coupon-remove-button" onClick={() => { setAppliedCoupon(null); setCouponError(''); }}>Remove</button> : <button type="button" className="coupon-apply-button" disabled={couponApplying || !couponCodeInput.trim()} onClick={applyCheckoutCoupon}>{couponApplying ? <LoaderCircle size={15} className="spin-icon" /> : 'Apply'}</button>}
                              </div>
                              {couponError && <p className="coupon-inline-error" role="alert">{couponError}</p>}
                              {appliedCoupon && <p className="coupon-inline-success"><Tag size={14} /> {appliedCoupon.code} applied · you save {peso(appliedCoupon.discount)}</p>}
                          </div>
                          <div className="checkout-summary">
                              {checkoutItems.map((item) => <div className="checkout-total-row checkout-item-row" key={item._id}><span>{item.name} × {item.quantity}</span><span>{peso(item.price * item.quantity)}</span></div>)}
                              <div className="checkout-total-row"><span>{checkoutItems.reduce((sum, item) => sum + item.quantity, 0)} item(s) · Subtotal</span><span>{peso(checkoutSubtotal)}</span></div>
                              {appliedCoupon && <div className="checkout-total-row coupon-discount-row"><span>Coupon · {appliedCoupon.code}</span><span>−{peso(checkoutDiscount)}</span></div>}
                              <div className="checkout-total-row"><span>Shipping</span><span>{checkoutShippingFee ? peso(checkoutShippingFee) : 'Free'}</span></div>
                              <div className="checkout-total-row checkout-grand-total"><strong>Total</strong><strong>{peso(checkoutTotal)}</strong></div>
                          </div>
                          <button
                              className="primary-button modal-submit"
                              type="submit"
                              disabled={checkoutLoading}
                          >
                              {checkoutLoading ? (
                                  <LoaderCircle
                                      className="spin-icon"
                                      size={17}
                                  />
                              ) : (
                                  <ShoppingBag size={16} />
                              )}{" "}
                              {checkoutLoading
                                  ? "Placing order…"
                                  : "Place order"}
                          </button>
                      </form>
                  </section>
              </div>
          )}

          {reviewTarget && (
              <div className="modal-backdrop review-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !reviewSaving) setReviewTarget(null); }}>
                  <section className="form-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
                      <div className="modal-heading"><div><span className="eyebrow">YOUR VERIFIED PURCHASE</span><h2 id="review-title">{reviewTarget.existing ? 'Edit your review' : 'Write a review'}</h2><p>{reviewTarget.name}</p></div><button className="icon-button" type="button" disabled={reviewSaving} onClick={() => setReviewTarget(null)} aria-label="Close review form"><X size={20} /></button></div>
                      <form className="modal-form" onSubmit={submitProductReview}>
                          <div className="review-rating-field"><span>Your rating</span><div role="radiogroup" aria-label="Choose a rating">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" role="radio" aria-checked={reviewForm.rating === rating} aria-label={`${rating} star${rating === 1 ? '' : 's'}`} onClick={() => setReviewForm((previous) => ({ ...previous, rating }))}><Star size={29} fill={reviewForm.rating >= rating ? 'currentColor' : 'none'} /></button>)}</div></div>
                          <label htmlFor="product-review-comment">Your review<textarea id="product-review-comment" value={reviewForm.comment} onChange={(event) => setReviewForm((previous) => ({ ...previous, comment: event.target.value }))} placeholder="What did you think about this item?" minLength={2} maxLength={1000} required rows={5} /></label>
                          <button className="primary-button modal-submit" type="submit" disabled={reviewSaving}>{reviewSaving ? <LoaderCircle size={17} className="spin-icon" /> : <Star size={16} />}{reviewSaving ? 'Saving review…' : 'Save review'}</button>
                      </form>
                  </section>
              </div>
          )}

          {detailProduct && (
              <div className="product-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProductDetails(); }}>
                  <section className="product-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
                      <button className="icon-button product-detail-close" type="button" onClick={closeProductDetails} aria-label="Close product details"><X size={21} /></button>
                      <div className="product-detail-gallery">
                          <div className="product-detail-main-image" style={{ background: detailProduct.bg || '#e2efff' }}>
                              <img src={detailImages[detailImageIndex] || placeholderImage} alt={detailProduct.name} />
                              {detailProduct.tag && <span className="product-detail-tag">{detailProduct.tag}</span>}
                          </div>
                          {detailImages.length > 1 && <div className="product-detail-thumbnails" aria-label="Product images">{detailImages.map((image, index) => <button key={`${image}-${index}`} type="button" className={detailImageIndex === index ? 'product-detail-thumbnail active' : 'product-detail-thumbnail'} onClick={() => setDetailImageIndex(index)} aria-label={`Show product image ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
                      </div>
                      <div className="product-detail-content">
                          <span className="eyebrow"><span className="eyebrow-line" /> {detailProduct.category || 'PRODUCT'}</span>
                          <h2 id="product-detail-title">{detailProduct.name}</h2>
                          <div className="product-detail-rating">{Number(detailProduct.reviews) > 0 ? <><Star size={16} fill="currentColor" /> {Number(detailProduct.rating).toFixed(1)}<span>({detailProduct.reviews} reviews)</span></> : <span>New · No reviews yet</span>}</div>
                          <div className="product-detail-price">{peso(detailProduct.price)}{detailProduct.oldPrice && <del>{peso(detailProduct.oldPrice)}</del>}</div>
                          <p className="product-detail-description">{detailProduct.description || 'More details for this item will be available soon.'}</p>
                          <section className="product-detail-reviews" aria-label="Customer reviews"><h3>Customer reviews <span>({Number(detailProduct.reviews) || 0})</span></h3>{detailReviews.length ? detailReviews.slice(0, 3).map((review) => <article key={review._id}><div><strong>{[review.userId?.firstName, review.userId?.lastName].filter(Boolean).join(' ') || 'Verified customer'}</strong><span><Star size={12} fill="currentColor" /> {review.rating}</span></div><p>{review.comment}</p></article>) : <p className="product-detail-no-reviews">No reviews yet. Customers can review this item after delivery.</p>}</section>
                          <dl className="product-detail-facts"><div><dt>Category</dt><dd>{detailProduct.category || '—'}</dd></div><div><dt>Brand</dt><dd>{detailProduct.brand || 'Not specified'}</dd></div></dl>
                          {Array.isArray(detailProduct.sizes) && detailProduct.sizes.length > 0 && <div className="product-detail-variants"><strong>Available sizes</strong><div>{detailProduct.sizes.map((size) => <span key={String(size.label || size)}>{typeof size === 'object' ? size.label : size}</span>)}</div></div>}
                          {Array.isArray(detailProduct.colors) && detailProduct.colors.length > 0 && <div className="product-detail-variants"><strong>Available colors</strong><div>{detailProduct.colors.map((color) => <span key={String(color.name || color)}>{typeof color === 'object' ? color.name : color}</span>)}</div></div>}
                          <div className={`product-detail-stock ${detailStock === 0 ? 'is-out' : detailStock <= 5 ? 'is-low' : ''}`}><span />{detailStock === 0 ? 'Out of stock' : detailStock <= 5 ? `Only ${detailStock} left in stock` : 'In stock'}</div>
                          {detailError && <p className="product-detail-error" role="status">{detailError}</p>}
                          <div className="product-detail-actions">
                              <div className="product-detail-quantity" aria-label="Quantity selector"><button type="button" onClick={() => setDetailQuantity((quantity) => Math.max(1, quantity - 1))} disabled={detailQuantity <= 1} aria-label="Decrease quantity"><Minus size={16} /></button><span>{detailQuantity}</span><button type="button" onClick={() => setDetailQuantity((quantity) => Math.min(detailAddableStock, quantity + 1))} disabled={detailQuantity >= detailAddableStock} aria-label="Increase quantity"><Plus size={16} /></button></div>
                              <button type="button" className="primary-button product-detail-add" disabled={detailLoading || detailAddableStock <= 0 || detailQuantity > detailAddableStock} onClick={() => addToCart(detailProduct, detailQuantity)}>{detailLoading ? <LoaderCircle size={17} className="spin-icon" /> : <ShoppingBag size={17} />}{detailLoading ? 'Loading…' : 'Add to bag'}</button>
                              <button type="button" className="product-detail-buy" disabled={detailLoading || detailStock <= 0} onClick={() => buyNow(detailProduct)}><ArrowRight size={16} />Buy now</button>
                              <button type="button" className={wishlist.includes(detailProduct._id) ? 'product-detail-wish wished' : 'product-detail-wish'} onClick={() => toggleWish(detailProduct._id)} aria-label={wishlist.includes(detailProduct._id) ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={20} fill={wishlist.includes(detailProduct._id) ? 'currentColor' : 'none'} /></button>
                          </div>
                          {detailAddableStock > 0 && <small className="product-detail-remaining">{detailAddableStock} available to add</small>}
                      </div>
                  </section>
              </div>
          )}

          {cartOpen && (
              <div
                  className="drawer-backdrop"
                  onClick={() => setCartOpen(false)}
              >
                  <aside
                      className="cart-drawer"
                      onClick={(event) => event.stopPropagation()}
                  >
                      <div className="drawer-header">
                          <div>
                              <span className="eyebrow">YOUR LITTLE FINDS</span>
                              <h2>
                                  Your bag <span>({cartCount})</span>
                              </h2>
                          </div>
                          <button
                              className="icon-button"
                              onClick={() => setCartOpen(false)}
                              aria-label="Close cart"
                          >
                              <X size={21} />
                          </button>
                      </div>
                      {cartItems.length === 0 ? (
                          <div className="cart-empty">
                              <div className="empty-bag">
                                  <ShoppingBag size={29} />
                              </div>
                              <h3>Your bag is taking a little nap.</h3>
                              <p>Find something lovely to bring home.</p>
                              <button
                                  className="primary-button"
                                  onClick={() => {
                                      setCartOpen(false);
                                      goProducts();
                                  }}
                              >
                                  Explore the collection{" "}
                                  <ArrowRight size={16} />
                              </button>
                          </div>
                      ) : (
                          <>
                              <div className="cart-items">
                                  {cartItems.map((item) => (
                                      <div className="cart-item" key={item._id}>
                                          <img
                                              src={
                                                  item.image || placeholderImage
                                              }
                                              alt={item.name}
                                          />
                                          <div className="cart-item-info">
                                              <h3>{item.name}</h3>
                                              <small>
                                                  {item.category} · {item.stock}{" "}
                                                  in stock
                                              </small>
                                              <b>{peso(item.price)}</b>
                                              <div className="quantity-control">
                                                  <button
                                                      onClick={() =>
                                                          changeQty(
                                                              item._id,
                                                              -1,
                                                          )
                                                      }
                                                      aria-label="Decrease quantity"
                                                  >
                                                      <Minus size={13} />
                                                  </button>
                                                  <span>{item.quantity}</span>
                                                  <button
                                                      onClick={() =>
                                                          changeQty(item._id, 1)
                                                      }
                                                      aria-label="Increase quantity"
                                                      disabled={
                                                          item.quantity >=
                                                          item.stock
                                                      }
                                                  >
                                                      <Plus size={13} />
                                                  </button>
                                              </div>
                                          </div>
                                          <button
                                              className="remove-item"
                                              onClick={() =>
                                                  setCartQuantity(item._id, 0)
                                              }
                                              aria-label={`Remove ${item.name}`}
                                          >
                                              <X size={15} />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                              <div className="cart-footer">
                                  <div className="shipping-progress">
                                      <Truck size={16} />
                                      {subtotal >= 1500
                                          ? "You unlocked free shipping!"
                                          : `You’re ${peso(1500 - subtotal)} away from free shipping`}
                                      <div className="progress-track">
                                          <span
                                              style={{
                                                  width: `${Math.min(100, (subtotal / 1500) * 100)}%`,
                                              }}
                                          />
                                      </div>
                                  </div>
                                  <div className="subtotal-row">
                                      <span>Subtotal</span>
                                      <b>{peso(subtotal)}</b>
                                  </div>
                                  <small className="checkout-note">
                                      Shipping fee is confirmed by the server
                                      when you place your order.
                                  </small>
                                  <button
                                      className="primary-button checkout-button"
                                      onClick={startCheckout}
                                  >
                                      Continue to checkout{" "}
                                      <ArrowRight size={17} />
                                  </button>
                              </div>
                          </>
                      )}
                  </aside>
              </div>
          )}

          <div className="connection-indicator" title={`API: ${API_BASE_URL}`}>
              <span
                  className={`status-dot ${catalogSource === "api" ? "connected" : ""}`}
              ></span>
              {catalogSource === "api"
                  ? "Server connected"
                  : catalogSource === "loading"
                    ? "Connecting to server…"
                    : "Demo mode · server offline"}
          </div>
      </div>
  );
}

export default App;
