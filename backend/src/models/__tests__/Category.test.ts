import { Category, ICategory } from '../Category'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('Category Model', () => {
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
    await Category.deleteMany({})
  })

  describe('Category Creation', () => {
    it('should create a root category with level 0', async () => {
      const categoryData = {
        name: 'Electronics',
        icon: 'electronics-icon',
        order: 1
      }

      const category = new Category(categoryData)
      await category.save()

      expect(category.name).toBe('Electronics')
      expect(category.slug).toBe('electronics')
      expect(category.level).toBe(0)
      expect(category.parent).toBeNull()
      expect(category.isActive).toBe(true)
      expect(category.icon).toBe('electronics-icon')
      expect(category.order).toBe(1)
    })

    it('should auto-generate slug from name', async () => {
      const category = new Category({
        name: 'Mobile Phones & Accessories'
      })
      await category.save()

      expect(category.slug).toBe('mobile-phones-and-accessories')
    })

    it('should create a subcategory with correct level', async () => {
      // Create parent category
      const parent = new Category({
        name: 'Electronics'
      })
      await parent.save()

      // Create child category
      const child = new Category({
        name: 'Mobile Phones',
        parent: parent._id
      })
      await child.save()

      expect(child.level).toBe(1)
      expect(child.parent?.toString()).toBe(parent._id.toString())
      expect(child.slug).toBe('electronics-mobile-phones')
    })

    it('should create a sub-subcategory with correct level', async () => {
      // Create root category
      const root = new Category({
        name: 'Electronics'
      })
      await root.save()

      // Create subcategory
      const sub = new Category({
        name: 'Mobile Phones',
        parent: root._id
      })
      await sub.save()

      // Create sub-subcategory
      const subSub = new Category({
        name: 'Smartphones',
        parent: sub._id
      })
      await subSub.save()

      expect(subSub.level).toBe(2)
      expect(subSub.parent?.toString()).toBe(sub._id.toString())
      expect(subSub.slug).toBe('electronics-mobile-phones-smartphones')
    })
  })

  describe('Category Validation', () => {
    it('should require name field', async () => {
      const category = new Category({})

      await expect(category.save()).rejects.toThrow()
    })

    it('should enforce name length constraints', async () => {
      // Too short
      const shortName = new Category({ name: 'A' })
      await expect(shortName.save()).rejects.toThrow()

      // Too long
      const longName = new Category({ 
        name: 'A'.repeat(101) 
      })
      await expect(longName.save()).rejects.toThrow()
    })

    it('should enforce unique slug constraint', async () => {
      const category1 = new Category({ name: 'Electronics' })
      await category1.save()

      const category2 = new Category({ name: 'Electronics' })
      await expect(category2.save()).rejects.toThrow()
    })

    it('should enforce unique name within same parent level', async () => {
      const parent = new Category({ name: 'Electronics' })
      await parent.save()

      const child1 = new Category({
        name: 'Mobile Phones',
        parent: parent._id
      })
      await child1.save()

      const child2 = new Category({
        name: 'Mobile Phones',
        parent: parent._id
      })
      await expect(child2.save()).rejects.toThrow()
    })

    it('should allow same name in different parent levels', async () => {
      const parent1 = new Category({ name: 'Electronics' })
      await parent1.save()

      const parent2 = new Category({ name: 'Fashion' })
      await parent2.save()

      const child1 = new Category({
        name: 'Accessories',
        parent: parent1._id
      })
      await child1.save()

      const child2 = new Category({
        name: 'Accessories',
        parent: parent2._id
      })
      await child2.save()

      expect(child1.name).toBe(child2.name)
      expect(child1.parent?.toString()).not.toBe(child2.parent?.toString())
      expect(child1.slug).toBe('electronics-accessories')
      expect(child2.slug).toBe('fashion-accessories')
    })

    it('should prevent hierarchy depth exceeding 3 levels', async () => {
      // Create 3 levels (0, 1, 2)
      const level0 = new Category({ name: 'Electronics' })
      await level0.save()

      const level1 = new Category({
        name: 'Mobile Phones',
        parent: level0._id
      })
      await level1.save()

      const level2 = new Category({
        name: 'Smartphones',
        parent: level1._id
      })
      await level2.save()

      // Try to create level 3 (should fail)
      const level3 = new Category({
        name: 'Android Phones',
        parent: level2._id
      })
      await expect(level3.save()).rejects.toThrow('Category hierarchy cannot exceed 3 levels')
    })

    it('should validate parent exists', async () => {
      const nonExistentId = new mongoose.Types.ObjectId()
      const category = new Category({
        name: 'Test Category',
        parent: nonExistentId
      })

      await expect(category.save()).rejects.toThrow('Parent category not found')
    })
  })

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test hierarchy
      const electronics = new Category({ name: 'Electronics', order: 1 })
      await electronics.save()

      const fashion = new Category({ name: 'Fashion', order: 2 })
      await fashion.save()

      const mobiles = new Category({
        name: 'Mobile Phones',
        parent: electronics._id,
        order: 1
      })
      await mobiles.save()

      const smartphones = new Category({
        name: 'Smartphones',
        parent: mobiles._id,
        order: 1
      })
      await smartphones.save()

      const inactiveCategory = new Category({
        name: 'Inactive Category',
        isActive: false
      })
      await inactiveCategory.save()
    })

    it('should find categories by level', async () => {
      const level0Categories = await Category.findByLevel(0)
      expect(level0Categories).toHaveLength(2)
      expect(level0Categories[0].name).toBe('Electronics')
      expect(level0Categories[1].name).toBe('Fashion')

      const level1Categories = await Category.findByLevel(1)
      expect(level1Categories).toHaveLength(1)
      expect(level1Categories[0].name).toBe('Mobile Phones')

      const level2Categories = await Category.findByLevel(2)
      expect(level2Categories).toHaveLength(1)
      expect(level2Categories[0].name).toBe('Smartphones')
    })

    it('should find root categories', async () => {
      const rootCategories = await Category.findRootCategories()
      expect(rootCategories).toHaveLength(2)
      expect(rootCategories[0].name).toBe('Electronics')
      expect(rootCategories[1].name).toBe('Fashion')
    })

    it('should build category tree', async () => {
      const tree = await Category.buildCategoryTree()
      expect(tree).toHaveLength(2)

      const electronics = tree.find(cat => cat.name === 'Electronics')
      expect(electronics).toBeDefined()
      expect(electronics!.children).toHaveLength(1)
      expect(electronics!.children[0].name).toBe('Mobile Phones')
      expect(electronics!.children[0].children).toHaveLength(1)
      expect(electronics!.children[0].children[0].name).toBe('Smartphones')

      const fashion = tree.find(cat => cat.name === 'Fashion')
      expect(fashion).toBeDefined()
      expect(fashion!.children).toHaveLength(0)
    })

    it('should validate hierarchy depth', async () => {
      const electronics = await Category.findOne({ name: 'Electronics' })
      const mobiles = await Category.findOne({ name: 'Mobile Phones' })
      const smartphones = await Category.findOne({ name: 'Smartphones' })

      // Root level is valid
      expect(await Category.validateHierarchyDepth()).toBe(true)

      // Level 0 parent is valid (can create level 1)
      expect(await Category.validateHierarchyDepth(electronics!._id)).toBe(true)

      // Level 1 parent is valid (can create level 2)
      expect(await Category.validateHierarchyDepth(mobiles!._id)).toBe(true)

      // Level 2 parent is invalid (cannot create level 3)
      expect(await Category.validateHierarchyDepth(smartphones!._id)).toBe(false)
    })
  })

  describe('Instance Methods', () => {
    let electronics: ICategory
    let mobiles: ICategory
    let smartphones: ICategory

    beforeEach(async () => {
      electronics = new Category({ name: 'Electronics' })
      await electronics.save()

      mobiles = new Category({
        name: 'Mobile Phones',
        parent: electronics._id
      })
      await mobiles.save()

      smartphones = new Category({
        name: 'Smartphones',
        parent: mobiles._id
      })
      await smartphones.save()
    })

    it('should get ancestors', async () => {
      const ancestors = await smartphones.getAncestors()
      expect(ancestors).toHaveLength(2)
      expect(ancestors[0].name).toBe('Electronics')
      expect(ancestors[1].name).toBe('Mobile Phones')

      const mobilesAncestors = await mobiles.getAncestors()
      expect(mobilesAncestors).toHaveLength(1)
      expect(mobilesAncestors[0].name).toBe('Electronics')

      const electronicsAncestors = await electronics.getAncestors()
      expect(electronicsAncestors).toHaveLength(0)
    })

    it('should get descendants', async () => {
      const descendants = await electronics.getDescendants()
      expect(descendants).toHaveLength(2)
      expect(descendants.map(d => d.name)).toContain('Mobile Phones')
      expect(descendants.map(d => d.name)).toContain('Smartphones')

      const mobilesDescendants = await mobiles.getDescendants()
      expect(mobilesDescendants).toHaveLength(1)
      expect(mobilesDescendants[0].name).toBe('Smartphones')

      const smartphonesDescendants = await smartphones.getDescendants()
      expect(smartphonesDescendants).toHaveLength(0)
    })

    it('should calculate level', async () => {
      expect(await electronics.calculateLevel()).toBe(0)
      expect(await mobiles.calculateLevel()).toBe(1)
      expect(await smartphones.calculateLevel()).toBe(2)
    })
  })

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await Category.collection.getIndexes()
      
      // Check for required indexes
      expect(indexes).toHaveProperty('slug_1')
      expect(indexes).toHaveProperty('parent_1')
      expect(indexes).toHaveProperty('level_1')
    })
  })
})