import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Review, IReview } from '../Review'
import { Product } from '../Product'
import { Order } from '../Order'

// Set test environment
process.env.NODE_ENV = 'test'

describe('Review Model', () => {
  let mongoServer: MongoMemoryServer

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
    await Order.deleteMany({})
  })

  describe('Schema Validation', () => {
    const validReviewData: Partial<IReview> = {
      product: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      order: new mongoose.Types.ObjectId(),
      rating: 4,
      comment: 'Great product!',
      isVerifiedPurchase: true
    }

    it('should create a valid review', async () => {
      const review = new Review(validReviewData)
      const savedReview = await review.save()

      expect(savedReview._id).toBeDefined()
      expect(savedReview.product).toEqual(validReviewData.product)
      expect(savedReview.user).toEqual(validReviewData.user)
      expect(savedReview.order).toEqual(validReviewData.order)
      expect(savedReview.rating).toBe(validReviewData.rating)
      expect(savedReview.comment).toBe(validReviewData.comment)
      expect(savedReview.isVerifiedPurchase).toBe(true)
      expect(savedReview.createdAt).toBeDefined()
      expect(savedReview.updatedAt).toBeDefined()
    })

    it('should create a review without comment', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.comment

      const review = new Review(reviewData)
      const savedReview = await review.save()

      expect(savedReview.comment).toBeUndefined()
      expect(savedReview.rating).toBe(reviewData.rating)
    })

    it('should default isVerifiedPurchase to true', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.isVerifiedPurchase

      const review = new Review(reviewData)
      const savedReview = await review.save()

      expect(savedReview.isVerifiedPurchase).toBe(true)
    })

    it('should require product field', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.product

      const review = new Review(reviewData)
      
      await expect(review.save()).rejects.toThrow(/product.*required/i)
    })

    it('should require user field', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.user

      const review = new Review(reviewData)
      
      await expect(review.save()).rejects.toThrow(/user.*required/i)
    })

    it('should require order field', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.order

      const review = new Review(reviewData)
      
      await expect(review.save()).rejects.toThrow(/order.*required/i)
    })

    it('should require rating field', async () => {
      const reviewData = { ...validReviewData }
      delete reviewData.rating

      const review = new Review(reviewData)
      
      await expect(review.save()).rejects.toThrow(/rating.*required/i)
    })
  })

  describe('Rating Validation', () => {
    const baseReviewData: Partial<IReview> = {
      product: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      order: new mongoose.Types.ObjectId(),
      isVerifiedPurchase: true
    }

    it('should accept valid ratings (1-5)', async () => {
      for (let rating = 1; rating <= 5; rating++) {
        const review = new Review({ ...baseReviewData, rating })
        const savedReview = await review.save()
        expect(savedReview.rating).toBe(rating)
        
        // Clean up for next iteration
        await review.deleteOne()
      }
    })

    it('should reject rating below 1', async () => {
      const review = new Review({ ...baseReviewData, rating: 0 })
      
      await expect(review.save()).rejects.toThrow(/Rating must be at least 1 star/i)
    })

    it('should reject rating above 5', async () => {
      const review = new Review({ ...baseReviewData, rating: 6 })
      
      await expect(review.save()).rejects.toThrow(/Rating cannot exceed 5 stars/i)
    })

    it('should reject non-integer ratings', async () => {
      const review = new Review({ ...baseReviewData, rating: 3.5 })
      
      await expect(review.save()).rejects.toThrow(/Rating must be an integer between 1 and 5/i)
    })
  })

  describe('Comment Validation', () => {
    const baseReviewData: Partial<IReview> = {
      product: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      order: new mongoose.Types.ObjectId(),
      rating: 4,
      isVerifiedPurchase: true
    }

    it('should accept valid comments', async () => {
      const comment = 'This is a great product with excellent quality!'
      const review = new Review({ ...baseReviewData, comment })
      const savedReview = await review.save()

      expect(savedReview.comment).toBe(comment)
    })

    it('should trim whitespace from comments', async () => {
      const comment = '  Great product!  '
      const review = new Review({ ...baseReviewData, comment })
      const savedReview = await review.save()

      expect(savedReview.comment).toBe('Great product!')
    })

    it('should set empty comments to undefined', async () => {
      const review = new Review({ ...baseReviewData, comment: '   ' })
      const savedReview = await review.save()

      expect(savedReview.comment).toBeUndefined()
    })

    it('should reject comments longer than 1000 characters', async () => {
      const longComment = 'a'.repeat(1001)
      const review = new Review({ ...baseReviewData, comment: longComment })
      
      await expect(review.save()).rejects.toThrow(/Comment cannot exceed 1000 characters/i)
    })

    it('should accept comments exactly 1000 characters', async () => {
      const maxComment = 'a'.repeat(1000)
      const review = new Review({ ...baseReviewData, comment: maxComment })
      const savedReview = await review.save()

      expect(savedReview.comment).toBe(maxComment)
      expect(savedReview.comment?.length).toBe(1000)
    })
  })

  describe('Unique Constraint', () => {
    const productId = new mongoose.Types.ObjectId()
    const userId = new mongoose.Types.ObjectId()
    const orderId = new mongoose.Types.ObjectId()

    const reviewData = {
      product: productId,
      user: userId,
      order: orderId,
      rating: 4,
      comment: 'First review'
    }

    it('should allow one review per user per product', async () => {
      const review = new Review(reviewData)
      const savedReview = await review.save()

      expect(savedReview._id).toBeDefined()
    })

    it('should prevent duplicate reviews from same user for same product', async () => {
      // Create first review
      const firstReview = new Review(reviewData)
      await firstReview.save()

      // Try to create second review with same user and product
      const secondReview = new Review({
        ...reviewData,
        order: new mongoose.Types.ObjectId(), // Different order
        comment: 'Second review attempt'
      })

      await expect(secondReview.save()).rejects.toThrow(/duplicate key error/i)
    })

    it('should allow different users to review the same product', async () => {
      // Create first review
      const firstReview = new Review(reviewData)
      await firstReview.save()

      // Create second review with different user
      const secondReview = new Review({
        ...reviewData,
        user: new mongoose.Types.ObjectId(), // Different user
        order: new mongoose.Types.ObjectId(), // Different order
        comment: 'Review from different user'
      })

      const savedSecondReview = await secondReview.save()
      expect(savedSecondReview._id).toBeDefined()
    })

    it('should allow same user to review different products', async () => {
      // Create first review
      const firstReview = new Review(reviewData)
      await firstReview.save()

      // Create second review with different product
      const secondReview = new Review({
        ...reviewData,
        product: new mongoose.Types.ObjectId(), // Different product
        order: new mongoose.Types.ObjectId(), // Different order
        comment: 'Review for different product'
      })

      const savedSecondReview = await secondReview.save()
      expect(savedSecondReview._id).toBeDefined()
    })
  })

  describe('Static Methods', () => {
    let productId: mongoose.Types.ObjectId
    let userId1: mongoose.Types.ObjectId
    let userId2: mongoose.Types.ObjectId

    beforeEach(async () => {
      productId = new mongoose.Types.ObjectId()
      userId1 = new mongoose.Types.ObjectId()
      userId2 = new mongoose.Types.ObjectId()

      // Create test reviews
      await Review.create([
        {
          product: productId,
          user: userId1,
          order: new mongoose.Types.ObjectId(),
          rating: 5,
          comment: 'Excellent product!',
          createdAt: new Date('2023-01-01')
        },
        {
          product: productId,
          user: userId2,
          order: new mongoose.Types.ObjectId(),
          rating: 4,
          comment: 'Good quality',
          createdAt: new Date('2023-01-02')
        },
        {
          product: new mongoose.Types.ObjectId(), // Different product
          user: userId1,
          order: new mongoose.Types.ObjectId(),
          rating: 3,
          comment: 'Average product',
          createdAt: new Date('2023-01-03')
        }
      ])
    })

    describe('findByProduct', () => {
      it('should find reviews for a specific product', async () => {
        const reviews = await Review.findByProduct(productId)
        
        expect(reviews).toHaveLength(2)
        expect(reviews.every(review => review.product.toString() === productId.toString())).toBe(true)
      })

      it('should sort reviews by creation date (newest first) by default', async () => {
        const reviews = await Review.findByProduct(productId)
        
        expect(reviews[0].createdAt.getTime()).toBeGreaterThan(reviews[1].createdAt.getTime())
      })

      it('should support pagination', async () => {
        const reviews = await Review.findByProduct(productId, { page: 1, limit: 1 })
        
        expect(reviews).toHaveLength(1)
      })

      it('should filter by verified purchases only', async () => {
        // Create an unverified review
        await Review.create({
          product: productId,
          user: new mongoose.Types.ObjectId(),
          order: new mongoose.Types.ObjectId(),
          rating: 2,
          isVerifiedPurchase: false
        })

        const allReviews = await Review.findByProduct(productId)
        const verifiedReviews = await Review.findByProduct(productId, { verifiedOnly: true })
        
        expect(allReviews).toHaveLength(3)
        expect(verifiedReviews).toHaveLength(2)
        expect(verifiedReviews.every(review => review.isVerifiedPurchase)).toBe(true)
      })
    })

    describe('findByUser', () => {
      it('should find reviews by a specific user', async () => {
        const reviews = await Review.findByUser(userId1)
        
        expect(reviews).toHaveLength(2)
        expect(reviews.every(review => review.user.toString() === userId1.toString())).toBe(true)
      })

      it('should sort reviews by creation date (newest first)', async () => {
        const reviews = await Review.findByUser(userId1)
        
        expect(reviews[0].createdAt.getTime()).toBeGreaterThan(reviews[1].createdAt.getTime())
      })
    })

    describe('getProductReviewStats', () => {
      it('should calculate correct average rating and count', async () => {
        const stats = await Review.getProductReviewStats(productId)
        
        expect(stats.reviewCount).toBe(2)
        expect(stats.averageRating).toBe(4.5) // (5 + 4) / 2 = 4.5
      })

      it('should return zero stats for product with no reviews', async () => {
        const emptyProductId = new mongoose.Types.ObjectId()
        const stats = await Review.getProductReviewStats(emptyProductId)
        
        expect(stats.reviewCount).toBe(0)
        expect(stats.averageRating).toBe(0)
      })

      it('should round average rating to 2 decimal places', async () => {
        // Add a third review to create a non-round average
        await Review.create({
          product: productId,
          user: new mongoose.Types.ObjectId(),
          order: new mongoose.Types.ObjectId(),
          rating: 3
        })

        const stats = await Review.getProductReviewStats(productId)
        
        expect(stats.reviewCount).toBe(3)
        expect(stats.averageRating).toBe(4) // (5 + 4 + 3) / 3 = 4.00
      })
    })

    describe('hasUserReviewedProduct', () => {
      it('should return true if user has reviewed the product', async () => {
        const hasReviewed = await Review.hasUserReviewedProduct(userId1, productId)
        
        expect(hasReviewed).toBe(true)
      })

      it('should return false if user has not reviewed the product', async () => {
        const newUserId = new mongoose.Types.ObjectId()
        const hasReviewed = await Review.hasUserReviewedProduct(newUserId, productId)
        
        expect(hasReviewed).toBe(false)
      })

      it('should return false for non-existent product', async () => {
        const nonExistentProductId = new mongoose.Types.ObjectId()
        const hasReviewed = await Review.hasUserReviewedProduct(userId1, nonExistentProductId)
        
        expect(hasReviewed).toBe(false)
      })
    })
  })

  describe('Indexes', () => {
    it('should have the required indexes', async () => {
      const indexes = await Review.collection.getIndexes()
      const indexNames = Object.keys(indexes)
      
      // Check for required indexes
      expect(indexNames).toContain('product_1')
      expect(indexNames).toContain('user_1')
      expect(indexNames).toContain('createdAt_-1')
      expect(indexNames).toContain('unique_user_product_review')
      
      // Check compound unique index structure
      const uniqueIndex = indexes['unique_user_product_review']
      expect(uniqueIndex).toEqual([
        ['product', 1],
        ['user', 1]
      ])
    })
  })
})