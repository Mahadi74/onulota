import { Types } from 'mongoose'
import { Cart, ICart } from '../../models/Cart'
import { Product } from '../../models/Product'
import { AppError } from '../../middleware/errorHandler'

// Constants for cart calculations
const TAX_RATE = 0.05 // 5% tax
const SHIPPING_COST_THRESHOLD = 500 // Free shipping above 500 BDT
const STANDARD_SHIPPING_COST = 50 // 50 BDT standard shipping

/**
 * Interface for cart response with calculations
 */
export interface ICartResponse {
  _id: string
  items: Array<{
    _id: string
    product: {
      _id: string
      name: string
      price: number
      stock: number
    }
    quantity: number
    price: number
    subtotal: number
    isAvailable: boolean
    unavailableReason: string | null
  }>
  subtotal: number
  tax: number
  shippingCost: number
  total: number
  totalItems: number
}

/**
 * Get user's cart with calculated totals
 */
export async function getUserCart(userId: string | Types.ObjectId): Promise<ICartResponse> {
  // Find or create user cart
  let cart = await Cart.findByUser(userId)
  
  if (!cart) {
    // Create new cart if doesn't exist
    cart = await Cart.createUserCart(new Types.ObjectId(userId.toString()))
  }
  
  // Populate product details for each item
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Get guest cart by session ID with calculated totals
 */
export async function getGuestCart(sessionId: string): Promise<ICartResponse> {
  // Find or create guest cart
  let cart = await Cart.findBySession(sessionId)
  
  if (!cart) {
    // Create new cart if doesn't exist
    cart = await Cart.createGuestCart(sessionId)
  }
  
  // Populate product details for each item
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Add item to cart with stock availability verification
 * 
 * For authenticated users: adds to user's cart
 * For guests: adds to guest cart (requires sessionId)
 */
export async function addItemToCart(
  userId: string | undefined,
  productId: string,
  quantity: number,
  variantId?: string,
  sessionId?: string
): Promise<ICartResponse> {
  // Validate product exists and is active
  const product = await Product.findById(productId)
  
  if (!product) {
    throw new AppError('Product not found', 404)
  }
  
  if (!product.isActive) {
    throw new AppError('Product is no longer available', 400)
  }
  
  // Verify stock availability
  let availableStock = 0
  
  if (variantId) {
    // Check variant stock
    const variant = product.variants.find(v => v._id?.toString() === variantId)
    
    if (!variant) {
      throw new AppError('Product variant not found', 404)
    }
    
    availableStock = variant.stock
  } else {
    // Check product stock
    availableStock = product.stock
  }
  
  // Get or create cart first to check existing quantity
  let cart: ICart | null
  
  if (userId) {
    // Authenticated user
    cart = await Cart.findByUser(userId)
    
    if (!cart) {
      cart = await Cart.createUserCart(new Types.ObjectId(userId.toString()))
    }
  } else {
    // Guest user
    if (!sessionId) {
      throw new AppError('Session ID is required for guest users', 400)
    }
    
    cart = await Cart.findBySession(sessionId)
    
    if (!cart) {
      cart = await Cart.createGuestCart(sessionId)
    }
  }
  
  // Check if item already exists in cart
  const existingItem = cart.getItem(new Types.ObjectId(productId), variantId ? new Types.ObjectId(variantId) : undefined)
  const totalQuantity = (existingItem?.quantity || 0) + quantity
  
  // Verify total quantity doesn't exceed available stock
  if (availableStock < totalQuantity) {
    throw new AppError(
      `Insufficient stock. Available: ${availableStock}, Requested: ${totalQuantity}`,
      409
    )
  }
  
  // Add item to cart
  const variantObjectId = variantId ? new Types.ObjectId(variantId) : undefined
  await cart.addItem(
    new Types.ObjectId(productId),
    quantity,
    product.price,
    variantObjectId
  )
  
  // Populate product details for response
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Check availability of a cart item
 * Returns { isAvailable: boolean, unavailableReason: string | null }
 */
async function checkItemAvailability(
  productId: any,
  cartItem: any
): Promise<{ isAvailable: boolean; unavailableReason: string | null }> {
  // Fetch fresh product data to ensure we have latest stock/status
  const product = await Product.findById(productId)

  if (!product) {
    return {
      isAvailable: false,
      unavailableReason: 'Product is no longer available'
    }
  }

  // Check if product is active
  if (!product.isActive) {
    return {
      isAvailable: false,
      unavailableReason: 'Product is no longer available'
    }
  }

  // Check stock availability
  if (cartItem.variant) {
    // For variant items, check variant stock
    const variant = product.variants.find(
      (v: any) => v._id?.toString() === cartItem.variant?.toString()
    )

    if (!variant) {
      return {
        isAvailable: false,
        unavailableReason: 'Product variant is no longer available'
      }
    }

    if (variant.stock === 0) {
      return {
        isAvailable: false,
        unavailableReason: 'Variant out of stock'
      }
    }

    if (cartItem.quantity > variant.stock) {
      return {
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      }
    }
  } else {
    // For non-variant items, check product stock
    if (product.stock === 0) {
      return {
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      }
    }

    if (cartItem.quantity > product.stock) {
      return {
        isAvailable: false,
        unavailableReason: 'Insufficient stock available'
      }
    }
  }

  // All checks passed
  return {
    isAvailable: true,
    unavailableReason: null
  }
}

/**
 * Calculate cart totals (subtotal, tax, shipping, total)
 */
function calculateCartTotals(cart: ICart): {
  subtotal: number
  tax: number
  shippingCost: number
  total: number
} {
  // Calculate subtotal from items
  let subtotal = 0
  
  for (const item of cart.items) {
    // Get product price (use item price if available, otherwise use product price)
    const price = item.price || (item.product as any)?.price || 0
    subtotal += price * item.quantity
  }
  
  // Round to 2 decimal places
  subtotal = Math.round(subtotal * 100) / 100
  
  // Calculate tax (5% of subtotal)
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100
  
  // Calculate shipping cost
  // Free shipping for empty carts or orders above 500 BDT, otherwise 50 BDT
  const shippingCost = cart.items.length === 0 || subtotal >= SHIPPING_COST_THRESHOLD ? 0 : STANDARD_SHIPPING_COST
  
  // Calculate total
  const total = Math.round((subtotal + tax + shippingCost) * 100) / 100
  
  return {
    subtotal,
    tax,
    shippingCost,
    total
  }
}

/**
 * Update cart item quantity with stock availability verification
 * 
 * For authenticated users: updates item in user's cart
 * For guests: updates item in guest cart (requires sessionId)
 */
export async function updateCartItemQuantity(
  userId: string | undefined,
  itemId: string,
  newQuantity: number,
  sessionId?: string
): Promise<ICartResponse> {
  // Validate new quantity
  if (newQuantity < 1) {
    throw new AppError('Quantity must be at least 1', 400)
  }
  
  // Get or find cart
  let cart: ICart | null
  
  if (userId) {
    // Authenticated user
    cart = await Cart.findByUser(userId)
    
    if (!cart) {
      throw new AppError('Cart not found', 404)
    }
  } else {
    // Guest user
    if (!sessionId) {
      throw new AppError('Session ID is required for guest users', 400)
    }
    
    cart = await Cart.findBySession(sessionId)
    
    if (!cart) {
      throw new AppError('Cart not found', 404)
    }
  }
  
  // Find the cart item
  const cartItem = cart.items.find(item => item._id?.toString() === itemId)
  
  if (!cartItem) {
    throw new AppError('Cart item not found', 404)
  }
  
  // Get product to verify stock
  const product = await Product.findById(cartItem.product)
  
  if (!product) {
    throw new AppError('Product not found', 404)
  }
  
  if (!product.isActive) {
    throw new AppError('Product is no longer available', 400)
  }
  
  // Verify stock availability for new quantity
  let availableStock = 0
  
  if (cartItem.variant) {
    // Check variant stock
    const variant = product.variants.find(v => v._id?.toString() === cartItem.variant?.toString())
    
    if (!variant) {
      throw new AppError('Product variant not found', 404)
    }
    
    availableStock = variant.stock
  } else {
    // Check product stock
    availableStock = product.stock
  }
  
  // Verify new quantity doesn't exceed available stock
  if (availableStock < newQuantity) {
    throw new AppError(
      `Insufficient stock. Available: ${availableStock}, Requested: ${newQuantity}`,
      409
    )
  }
  
  // Update item quantity
  cartItem.quantity = newQuantity
  cartItem.addedAt = new Date()
  
  // Save cart
  await cart.save()
  
  // Populate product details for response
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Remove item from cart
 * 
 * For authenticated users: removes item from user's cart
 * For guests: removes item from guest cart (requires sessionId)
 */
export async function removeItemFromCart(
  userId: string | undefined,
  itemId: string,
  sessionId?: string
): Promise<ICartResponse> {
  // Get or find cart
  let cart: ICart | null
  
  if (userId) {
    // Authenticated user
    cart = await Cart.findByUser(userId)
    
    if (!cart) {
      throw new AppError('Cart not found', 404)
    }
  } else {
    // Guest user
    if (!sessionId) {
      throw new AppError('Session ID is required for guest users', 400)
    }
    
    cart = await Cart.findBySession(sessionId)
    
    if (!cart) {
      throw new AppError('Cart not found', 404)
    }
  }
  
  // Find the cart item
  const cartItem = cart.items.find(item => item._id?.toString() === itemId)
  
  if (!cartItem) {
    throw new AppError('Cart item not found', 404)
  }
  
  // Remove item from cart
  await cart.removeItem(cartItem._id!)
  
  // Populate product details for response
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Clear entire cart (remove all items)
 * 
 * For authenticated users: clears user's cart
 * For guests: clears guest cart (requires sessionId)
 */
export async function clearCart(
  userId: string | undefined,
  sessionId?: string
): Promise<ICartResponse> {
  // Get or find cart
  let cart: ICart | null
  
  if (userId) {
    // Authenticated user
    cart = await Cart.findByUser(userId)
    
    if (!cart) {
      // Create new cart if doesn't exist
      cart = await Cart.createUserCart(new Types.ObjectId(userId.toString()))
    }
  } else {
    // Guest user
    if (!sessionId) {
      throw new AppError('Session ID is required for guest users', 400)
    }
    
    cart = await Cart.findBySession(sessionId)
    
    if (!cart) {
      // Create new cart if doesn't exist
      cart = await Cart.createGuestCart(sessionId)
    }
  }
  
  // Clear all items from cart
  await cart.clearCart()
  
  // Populate product details for response (will be empty)
  await cart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals (will be zero)
  const calculations = calculateCartTotals(cart)
  
  // Format response
  return await formatCartResponse(cart, calculations)
}

/**
 * Merge guest cart with authenticated user's cart
 * 
 * For items that exist in both carts, prefer the higher quantity
 * Clears guest cart after successful merge
 * 
 * @param userId - Authenticated user ID
 * @param sessionId - Guest session ID
 * @returns Merged cart with recalculated totals
 */
export async function mergeGuestCartWithUserCart(
  userId: string | Types.ObjectId,
  sessionId: string
): Promise<ICartResponse> {
  // Find guest cart
  const guestCart = await Cart.findBySession(sessionId)
  
  if (!guestCart) {
    throw new AppError('Guest cart not found', 404)
  }
  
  // Find or create user cart
  let userCart = await Cart.findByUser(userId)
  
  if (!userCart) {
    userCart = await Cart.createUserCart(new Types.ObjectId(userId.toString()))
  }
  
  // Merge items from guest cart into user cart
  for (const guestItem of guestCart.items) {
    const existingUserItem = userCart.getItem(guestItem.product, guestItem.variant)
    
    if (existingUserItem) {
      // Item exists in both carts - prefer higher quantity
      if (guestItem.quantity > existingUserItem.quantity) {
        existingUserItem.quantity = guestItem.quantity
        existingUserItem.price = guestItem.price // Update to latest price
        existingUserItem.addedAt = guestItem.addedAt
      }
    } else {
      // Item only in guest cart - add to user cart
      userCart.items.push({
        product: guestItem.product,
        variant: guestItem.variant,
        quantity: guestItem.quantity,
        price: guestItem.price,
        addedAt: guestItem.addedAt
      })
    }
  }
  
  // Save merged user cart
  await userCart.save()
  
  // Delete guest cart
  await guestCart.deleteOne()
  
  // Populate product details for response
  await userCart.populate('items.product', 'name price stock isActive variants')
  
  // Calculate totals
  const calculations = calculateCartTotals(userCart)
  
  // Format response
  return await formatCartResponse(userCart, calculations)
}

/**
 * Format cart response with all details
 */
async function formatCartResponse(
  cart: ICart,
  calculations: {
    subtotal: number
    tax: number
    shippingCost: number
    total: number
  }
): Promise<ICartResponse> {
  const items = await Promise.all(cart.items.map(async (item) => {
    const product = item.product as any
    const itemPrice = item.price || product?.price || 0
    const itemSubtotal = Math.round(itemPrice * item.quantity * 100) / 100

    // Check item availability (fetches fresh product data)
    const { isAvailable, unavailableReason } = await checkItemAvailability(item.product, item)

    return {
      _id: item._id?.toString() || '',
      product: {
        _id: product?._id?.toString() || '',
        name: product?.name || 'Unknown Product',
        price: itemPrice,
        stock: product?.stock || 0
      },
      quantity: item.quantity,
      price: itemPrice,
      subtotal: itemSubtotal,
      isAvailable,
      unavailableReason
    }
  }))

  return {
    _id: cart._id.toString(),
    items,
    subtotal: calculations.subtotal,
    tax: calculations.tax,
    shippingCost: calculations.shippingCost,
    total: calculations.total,
    totalItems: cart.totalItems
  }
}
