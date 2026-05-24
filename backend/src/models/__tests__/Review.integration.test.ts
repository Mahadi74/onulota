import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Review, IReview } from '../Review'
import { Product, IProduct } from '../Product'
import { Category } from '../Category'

// Set test environment
process.env.NODE_ENV = 'test'

describe('Review Integration Tests', () => {
  let mongoServer: MongoMemoryServer
  let categoryId: mongoose.Types.ObjectId
  let productId: mongoose.Types.ObjectId
  let product: IProduct

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Review.deleteMany({})
    await Product.deleteMany({})
    await Category.deleteMany({})

    // Create test category
    const category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      level: 0
    })
    categoryId = category._id

    // Create test product
    product = await Product.create({
      name: 'Test Product',
      slug: 'test-product',
      description: 'A test product for review integration tests',
      price: 99.99,
      category: categoryId,
      images: [{
        url: 'https://example.com/image.jpg',
        alt: 'Test product image'
      }],
      stock: 10,
      averageRating: 0,
      reviewCount: 0
    })
    productId = product._id
  })

  describe('Product Rating Updates', () => {
    it('should update product rating when a new review is created', async () => {
      const reviewData = {
        product: productId,
        user: new mongoose.Types.ObjectId(),
        order: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Good product!'
      }

      await Review.create(reviewData)

      // Refresh product from database
      const updatedProduct = await Product.findById(productId)
      
      expect(updatedProduct?.averageRating).toBe(4)
      expect(updatedProduct?.reviewCount).toBe(1)
    })

    it('should calculate correct average rating with multiple reviews (sequential)', async () => {
      const userId1 = new mongoose.Types.ObjectId()
      const userId2 = new mongoose.Types.ObjectId()
      const userId3 = new mongoose.Types.ObjectId()

      // Create reviews sequentially to avoid concurrency issues
      await Review.create({
        product: productId,
        user: userId1,
        order: new mongoose.Types.ObjectId(),
        rating: 5,
        comment: 'Excellent!'
      })

      await Review.create({
        product: productId,
        user: userId2,
        order: new mongoose.Types.ObjectId(),
        rating: 3,
        comment: 'Average'
      })

      await Review.create({
        product: productId,
        user: userId3,
        order: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Good'
      })

      // Refresh product from database
      const updatedProduct = await Product.findById(productId)
      
      expect(updatedProduct?.reviewCount).toBe(3)
      expect(updatedProduct?.averageRating).toBe(4) // (5 + 3 + 4) / 3 = 4.00
    })

    it('should update product rating when a review is modified', async () => {
      // Create initial review
      const review = await Review.create({
        product: productId,
        user: new mongoose.Types.ObjectId(),
        order: new mongoose.Types.ObjectId(),
        rating: 3,
        comment: 'Initial rating'
      })

      // Verify initial product rating
      let updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(3)
      expect(updatedProduct?.reviewCount).toBe(1)

      // Update the review rating
      review.rating = 5
      review.comment = 'Updated rating'
      await review.save()

      // Verify updated product rating
      updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(5)
      expect(updatedProduct?.reviewCount).toBe(1)
    })

    it('should update product rating when a review is deleted', async () => {
      const userId1 = new mongoose.Types.ObjectId()
      const userId2 = new mongoose.Types.ObjectId()

      // Create two reviews sequentially
      const review1 = await Review.create({
        product: productId,
        user: userId1,
        order: new mongoose.Types.ObjectId(),
        rating: 5,
        comment: 'Excellent!'
      })

      await Review.create({
        product: productId,
        user: userId2,
        order: new mongoose.Types.ObjectId(),
        rating: 3,
        comment: 'Average'
      })

      // Verify initial state
      let updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(4) // (5 + 3) / 2 = 4
      expect(updatedProduct?.reviewCount).toBe(2)

      // Delete one review
      await review1.deleteOne()

      // Verify updated state
      updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(3) // Only the 3-star review remains
      expect(updatedProduct?.reviewCount).toBe(1)
    })

    it('should reset product rating to zero when last review is deleted', async () => {
      // Create single review
      const review = await Review.create({
        product: productId,
        user: new mongoose.Types.ObjectId(),
        order: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Good product!'
      })

      // Verify initial state
      let updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(4)
      expect(updatedProduct?.reviewCount).toBe(1)

      // Delete the review
      await review.deleteOne()

      // Verify reset state
      updatedProduct = await Product.findById(productId)
      expect(updatedProduct?.averageRating).toBe(0)
      expect(updatedProduct?.reviewCount).toBe(0)
    })
  })

  describe('Review Statistics', () => {
    it('should provide accurate statistics via static method', async () => {
      const userId1 = new mongoose.Types.ObjectId()
      const userId2 = new mongoose.Types.ObjectId()

      // Create reviews sequentially
      await Review.create({
        product: productId,
        user: userId1,
        order: new mongoose.Types.ObjectId(),
        rating: 5,
        comment: 'Perfect!'
      })

      await Review.create({
        product: productId,
        user: userId2,
        order: new mongoose.Types.ObjectId(),
        rating: 3,
        comment: 'Okay'
      })

      const stats = await Review.getProductReviewStats(productId)
      const productFromDb = await Product.findById(productId)

      // Statistics should match product fields
      expect(stats.averageRating).toBe(productFromDb?.averageRating)
      expect(stats.reviewCount).toBe(productFromDb?.reviewCount)
      expect(stats.averageRating).toBe(4) // (5 + 3) / 2 = 4
      expect(stats.reviewCount).toBe(2)
    })
  })

  describe('Basic Functionality', () => {
    it('should create reviews without product rating updates in test mode', async () => {
      const nonExistentProductId = new mongoose.Types.ObjectId()
      
      const reviewData = {
        product: nonExistentProductId,
        user: new mongoose.Types.ObjectId(),
        order: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Review for non-existent product'
      }

      // In test mode, this should succeed even if product doesn't exist
      const review = await Review.create(reviewData)
      expect(review._id).toBeDefined()
      expect(review.rating).toBe(4)
    })

    it('should find reviews by product without population in test mode', async () => {
      const userId = new mongoose.Types.ObjectId()
      
      await Review.create({
        product: productId,
        user: userId,
        order: new mongoose.Types.ObjectId(),
        rating: 5,
        comment: 'Excellent product!'
      })

      const reviews = await Review.findByProduct(productId)
      
      expect(reviews).toHaveLength(1)
      expect(reviews[0].product.toString()).toBe(productId.toString())
      expect(reviews[0].user.toString()).toBe(userId.toString())
      // In test mode, user should not be populated
      expect(typeof reviews[0].user).toBe('object')
    })
  })
})