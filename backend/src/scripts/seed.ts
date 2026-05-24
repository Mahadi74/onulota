/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing:
 *   - Admin user (bcrypt-hashed password)
 *   - 3 root categories with subcategories (respecting 3-level hierarchy)
 *   - 5+ sample products with Bangladesh market data (prices in BDT)
 *
 * Usage:
 *   npx ts-node src/scripts/seed.ts
 *
 * The script is idempotent: it clears existing seed data before re-seeding.
 */

import 'dotenv/config'
import mongoose, { Schema, Document, Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'

// ---------------------------------------------------------------------------
// Minimal User model (User.ts does not exist yet)
// ---------------------------------------------------------------------------

interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  password: string
  role: 'user' | 'admin'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const User = mongoose.models['User']
  ? (mongoose.model('User') as mongoose.Model<IUser>)
  : mongoose.model<IUser>('User', UserSchema)

// ---------------------------------------------------------------------------
// Import existing models
// ---------------------------------------------------------------------------

import { Category, Product, HomePromotion } from '../models/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  console.log(`[seed] ${message}`)
}

function makeSlug(name: string): string {
  return slugify(name, { lower: true, strict: true })
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'admin@onulota.com.bd'
const ADMIN_PASSWORD = 'Admin@1234'

/**
 * Category tree:
 *
 * Electronics (level 0)
 *   └─ Mobile Phones (level 1)
 *        └─ Smartphones (level 2)
 *   └─ Laptops & Computers (level 1)
 *
 * Fashion (level 0)
 *   └─ Men's Clothing (level 1)
 *        └─ T-Shirts (level 2)
 *   └─ Women's Clothing (level 1)
 *
 * Home & Living (level 0)
 *   └─ Kitchen & Dining (level 1)
 *   └─ Furniture (level 1)
 */

interface CategorySeed {
  name: string
  icon?: string
  order: number
  children?: CategorySeed[]
}

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Electronics',
    icon: '📱',
    order: 1,
    children: [
      {
        name: 'Mobile Phones',
        icon: '📞',
        order: 1,
        children: [
          { name: 'Smartphones', icon: '📲', order: 1 },
        ],
      },
      {
        name: 'Laptops & Computers',
        icon: '💻',
        order: 2,
      },
    ],
  },
  {
    name: 'Fashion',
    icon: '👗',
    order: 2,
    children: [
      {
        name: "Men's Clothing",
        icon: '👔',
        order: 1,
        children: [
          { name: 'T-Shirts', icon: '👕', order: 1 },
        ],
      },
      {
        name: "Women's Clothing",
        icon: '👘',
        order: 2,
      },
    ],
  },
  {
    name: 'Home & Living',
    icon: '🏠',
    order: 3,
    children: [
      { name: 'Kitchen & Dining', icon: '🍳', order: 1 },
      { name: 'Furniture', icon: '🛋️', order: 2 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Category seeding
// ---------------------------------------------------------------------------

/**
 * Recursively create categories, returning a map of name → ObjectId.
 */
async function seedCategories(
  nodes: CategorySeed[],
  parentId: Types.ObjectId | null,
  nameToId: Map<string, Types.ObjectId>
): Promise<void> {
  for (const node of nodes) {
    const slug = parentId
      ? `${nameToId.get(
          // find parent name by id
          [...nameToId.entries()].find(([, v]) => v.equals(parentId))?.[0] ?? ''
        )}-${makeSlug(node.name)}`
      : makeSlug(node.name)

    const category = new Category({
      name: node.name,
      slug,
      parent: parentId,
      icon: node.icon,
      order: node.order,
      isActive: true,
    })

    const saved = await category.save()
    log(`  Created category: ${node.name} (level ${saved.level})`)
    nameToId.set(node.name, saved._id)

    if (node.children && node.children.length > 0) {
      await seedCategories(node.children, saved._id, nameToId)
    }
  }
}

// ---------------------------------------------------------------------------
// Product seeding
// ---------------------------------------------------------------------------

interface ProductSeed {
  name: string
  description: string
  price: number
  compareAtPrice?: number
  categoryName: string
  stock: number
  isFeatured?: boolean
  tags: string[]
  specifications: { key: string; value: string }[]
}

const PRODUCTS: ProductSeed[] = [
  {
    name: 'Samsung Galaxy A54 5G',
    description:
      'Experience the next level of performance with the Samsung Galaxy A54 5G. Featuring a 6.4-inch Super AMOLED display, 50MP triple camera, and 5000mAh battery, this smartphone is built for the modern Bangladeshi user. Supports 5G connectivity for blazing-fast speeds.',
    price: 42999,
    compareAtPrice: 47999,
    categoryName: 'Smartphones',
    stock: 50,
    isFeatured: true,
    tags: ['samsung', 'android', '5g', 'smartphone'],
    specifications: [
      { key: 'Display', value: '6.4-inch Super AMOLED' },
      { key: 'Processor', value: 'Exynos 1380' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '50MP + 12MP + 5MP' },
      { key: 'OS', value: 'Android 13' },
    ],
  },
  {
    name: 'Xiaomi Redmi Note 12',
    description:
      'The Xiaomi Redmi Note 12 delivers flagship-level features at an affordable price. With a 6.67-inch AMOLED display, 50MP camera, and 5000mAh battery with 33W fast charging, it is the perfect daily driver for budget-conscious buyers in Bangladesh.',
    price: 22999,
    compareAtPrice: 25999,
    categoryName: 'Smartphones',
    stock: 80,
    isFeatured: false,
    tags: ['xiaomi', 'redmi', 'android', 'budget'],
    specifications: [
      { key: 'Display', value: '6.67-inch AMOLED' },
      { key: 'Processor', value: 'Snapdragon 685' },
      { key: 'RAM', value: '6 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Charging', value: '33W Fast Charging' },
    ],
  },
  {
    name: 'Realme Narzo 70',
    description:
      'The Realme Narzo 70 pairs a vibrant 6.72-inch display with a powerful Helio G99 chipset and 64MP camera. Great for multitasking, gaming, and social media in Bangladesh.',
    price: 17999,
    compareAtPrice: 19999,
    categoryName: 'Smartphones',
    stock: 70,
    isFeatured: false,
    tags: ['realme', 'narzo', 'android', 'budget'],
    specifications: [
      { key: 'Display', value: '6.72-inch LCD' },
      { key: 'Processor', value: 'MediaTek Helio G99' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '64MP + 2MP + 2MP' },
    ],
  },
  {
    name: 'OPPO A77s',
    description:
      'The OPPO A77s comes with a 6.56-inch display, 5000mAh battery, and 50MP main camera. It is a stylish everyday phone with reliable performance and long battery life.',
    price: 21999,
    compareAtPrice: 24999,
    categoryName: 'Smartphones',
    stock: 60,
    isFeatured: false,
    tags: ['oppo', 'a77s', 'android', 'camera'],
    specifications: [
      { key: 'Display', value: '6.56-inch LCD' },
      { key: 'Processor', value: 'MediaTek Helio G35' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '50MP + 2MP' },
    ],
  },
  {
    name: 'Vivo Y55',
    description:
      'The Vivo Y55 delivers a polished experience with Funtouch OS, a 50MP camera, and a large battery for daily use. An excellent choice for students and young professionals.',
    price: 19999,
    compareAtPrice: 22999,
    categoryName: 'Smartphones',
    stock: 90,
    isFeatured: false,
    tags: ['vivo', 'y55', 'android', 'battery'],
    specifications: [
      { key: 'Display', value: '6.58-inch LCD' },
      { key: 'Processor', value: 'MediaTek Helio G85' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '50MP + 2MP + 2MP' },
    ],
  },
  {
    name: 'Samsung Galaxy M14',
    description:
      'The Galaxy M14 is a dependable value phone with a large 6000mAh battery and 50MP camera. It offers Samsung’s One UI experience at a competitive price.',
    price: 23999,
    compareAtPrice: 26999,
    categoryName: 'Smartphones',
    stock: 55,
    isFeatured: false,
    tags: ['samsung', 'galaxy', 'android', 'battery'],
    specifications: [
      { key: 'Display', value: '6.5-inch PLS LCD' },
      { key: 'Processor', value: 'Exynos 1330' },
      { key: 'RAM', value: '6 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '6000 mAh' },
      { key: 'Camera', value: '50MP + 2MP + 2MP' },
    ],
  },
  {
    name: 'Infinix Hot 40',
    description:
      'The Infinix Hot 40 features a 6.78-inch display, 8GB RAM, and a responsive camera setup. It is a strong budget choice for everyday smartphone use.',
    price: 15999,
    compareAtPrice: 18999,
    categoryName: 'Smartphones',
    stock: 100,
    isFeatured: false,
    tags: ['infinix', 'hot40', 'android', 'budget'],
    specifications: [
      { key: 'Display', value: '6.78-inch LCD' },
      { key: 'Processor', value: 'MediaTek Helio G88' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '50MP + 2MP + AI Lens' },
    ],
  },
  {
    name: 'Poco X6 Pro',
    description:
      'The Poco X6 Pro brings flagship-style performance with Snapdragon 7+ Gen 2 and a premium AMOLED display. It is built for speed and content consumption.',
    price: 41999,
    compareAtPrice: 45999,
    categoryName: 'Smartphones',
    stock: 40,
    isFeatured: false,
    tags: ['poco', 'xiaomi', 'android', 'performance'],
    specifications: [
      { key: 'Display', value: '6.67-inch AMOLED' },
      { key: 'Processor', value: 'Qualcomm Snapdragon 7+ Gen 2' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '256 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '64MP + 8MP + 2MP' },
    ],
  },
  {
    name: 'OnePlus Nord N30',
    description:
      'The OnePlus Nord N30 offers smooth performance, fast charging, and a clean Android experience. A modern midrange phone for buyers who want premium value.',
    price: 35999,
    compareAtPrice: 39999,
    categoryName: 'Smartphones',
    stock: 35,
    isFeatured: false,
    tags: ['oneplus', 'nord', 'android', 'fast-charging'],
    specifications: [
      { key: 'Display', value: '6.7-inch AMOLED' },
      { key: 'Processor', value: 'Qualcomm Snapdragon 695' },
      { key: 'RAM', value: '8 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Charging', value: '67W Fast Charging' },
    ],
  },
  {
    name: 'Nokia G22',
    description:
      'The Nokia G22 is a reliable everyday smartphone with strong battery life and a durable design. It is ideal for users who value simplicity and stamina.',
    price: 15999,
    compareAtPrice: 17999,
    categoryName: 'Smartphones',
    stock: 85,
    isFeatured: false,
    tags: ['nokia', 'g22', 'android', 'durable'],
    specifications: [
      { key: 'Display', value: '6.5-inch HD+' },
      { key: 'Processor', value: 'Unisoc T606' },
      { key: 'RAM', value: '4 GB' },
      { key: 'Storage', value: '128 GB' },
      { key: 'Battery', value: '5050 mAh' },
      { key: 'Camera', value: '50MP + 2MP + 2MP' },
    ],
  },
  {
    name: 'Samsung Galaxy M04',
    description:
      'The Galaxy M04 is a budget friendly smartphone with a large 5000mAh battery and a simple, reliable design. Perfect for basic daily use and social browsing.',
    price: 11999,
    compareAtPrice: 13999,
    categoryName: 'Smartphones',
    stock: 120,
    isFeatured: false,
    tags: ['samsung', 'galaxy', 'budget', 'battery'],
    specifications: [
      { key: 'Display', value: '6.5-inch PLS LCD' },
      { key: 'Processor', value: 'MediaTek Helio P35' },
      { key: 'RAM', value: '4 GB' },
      { key: 'Storage', value: '64 GB' },
      { key: 'Battery', value: '5000 mAh' },
      { key: 'Camera', value: '13MP + 2MP' },
    ],
  },
  {
    name: 'HP 15s Core i5 Laptop',
    description:
      'The HP 15s is a reliable everyday laptop powered by Intel Core i5 12th Gen processor. With 8GB RAM, 512GB SSD, and a 15.6-inch Full HD display, it handles office work, browsing, and light creative tasks with ease. Ideal for students and professionals in Bangladesh.',
    price: 68000,
    compareAtPrice: 75000,
    categoryName: 'Laptops & Computers',
    stock: 25,
    isFeatured: true,
    tags: ['hp', 'laptop', 'intel', 'core-i5'],
    specifications: [
      { key: 'Processor', value: 'Intel Core i5-1235U' },
      { key: 'RAM', value: '8 GB DDR4' },
      { key: 'Storage', value: '512 GB SSD' },
      { key: 'Display', value: '15.6-inch Full HD IPS' },
      { key: 'OS', value: 'Windows 11 Home' },
      { key: 'Battery', value: '41 Wh' },
    ],
  },
  {
    name: 'Cotton Polo T-Shirt for Men',
    description:
      'Stay cool and stylish with this premium 100% cotton polo t-shirt. Available in multiple colours, this breathable and comfortable shirt is perfect for casual outings, office wear, and everyday use in the warm Bangladesh climate. Machine washable and durable.',
    price: 799,
    compareAtPrice: 1200,
    categoryName: 'T-Shirts',
    stock: 200,
    isFeatured: false,
    tags: ['polo', 'cotton', 'men', 'casual'],
    specifications: [
      { key: 'Material', value: '100% Cotton' },
      { key: 'Fit', value: 'Regular Fit' },
      { key: 'Collar', value: 'Polo Collar' },
      { key: 'Care', value: 'Machine Wash' },
    ],
  },
  {
    name: 'Non-Stick Frying Pan 28cm',
    description:
      'Cook healthier meals with this premium non-stick frying pan. The granite-coated surface ensures food does not stick, making cooking and cleaning effortless. Compatible with all stovetops including induction. A must-have for every Bangladeshi kitchen.',
    price: 1450,
    compareAtPrice: 1999,
    categoryName: 'Kitchen & Dining',
    stock: 120,
    isFeatured: false,
    tags: ['cookware', 'non-stick', 'kitchen', 'frying-pan'],
    specifications: [
      { key: 'Diameter', value: '28 cm' },
      { key: 'Coating', value: 'Granite Non-Stick' },
      { key: 'Compatible', value: 'All Stovetops + Induction' },
      { key: 'Handle', value: 'Heat-Resistant Bakelite' },
    ],
  },
  {
    name: 'Wooden Study Table with Drawer',
    description:
      'Upgrade your workspace with this elegant wooden study table. Featuring a spacious tabletop, a built-in drawer for storage, and a sturdy MDF frame with walnut finish, it is perfect for students and home offices. Easy to assemble with included hardware.',
    price: 8500,
    compareAtPrice: 11000,
    categoryName: 'Furniture',
    stock: 30,
    isFeatured: true,
    tags: ['furniture', 'study-table', 'wooden', 'home-office'],
    specifications: [
      { key: 'Material', value: 'MDF with Walnut Veneer' },
      { key: 'Dimensions', value: '120 x 60 x 75 cm' },
      { key: 'Drawers', value: '1 Drawer' },
      { key: 'Assembly', value: 'Self-Assembly Required' },
      { key: 'Weight Capacity', value: '50 kg' },
    ],
  },
  {
    name: "Women's Floral Kurti",
    description:
      "A beautiful floral-print kurti crafted from soft rayon fabric. This knee-length kurti features a round neck, 3/4 sleeves, and a relaxed fit that is both comfortable and stylish. Perfect for casual wear, family gatherings, and festive occasions in Bangladesh.",
    price: 1299,
    compareAtPrice: 1799,
    categoryName: "Women's Clothing",
    stock: 150,
    isFeatured: false,
    tags: ['kurti', 'women', 'floral', 'ethnic'],
    specifications: [
      { key: 'Material', value: 'Rayon' },
      { key: 'Length', value: 'Knee Length' },
      { key: 'Sleeve', value: '3/4 Sleeve' },
      { key: 'Neck', value: 'Round Neck' },
      { key: 'Care', value: 'Hand Wash Recommended' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set. Copy .env.example to .env and configure it.')
  }

  log('Connecting to MongoDB…')
  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
  })
  log('Connected.')

  // -------------------------------------------------------------------------
  // 1. Clear existing seed data (idempotent)
  // -------------------------------------------------------------------------
  log('Clearing existing seed data…')
  await Product.deleteMany({})
  await Category.deleteMany({})
  await HomePromotion.deleteMany({})
  await User.deleteMany({ role: 'admin' })
  log('Cleared products, categories, homepage promotions, and admin users.')

  // -------------------------------------------------------------------------
  // 2. Create admin user
  // -------------------------------------------------------------------------
  log('Creating admin user…')
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10)
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds)

  const adminUser = await User.create({
    name: 'Platform Admin',
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
  })
  log(`  Admin user created: ${adminUser.email}`)

  // -------------------------------------------------------------------------
  // 3. Create categories
  // -------------------------------------------------------------------------
  log('Creating categories…')
  const nameToId = new Map<string, Types.ObjectId>()
  await seedCategories(CATEGORY_TREE, null, nameToId)
  log(`  Total categories created: ${nameToId.size}`)

  // -------------------------------------------------------------------------
  // 4. Create products
  // -------------------------------------------------------------------------
  log('Creating products…')
  let productCount = 0

  for (const p of PRODUCTS) {
    const categoryId = nameToId.get(p.categoryName)
    if (!categoryId) {
      log(`  WARNING: Category "${p.categoryName}" not found — skipping product "${p.name}"`)
      continue
    }

    const product = new Product({
      name: p.name,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      category: categoryId,
      stock: p.stock,
      isFeatured: p.isFeatured ?? false,
      tags: p.tags,
      specifications: p.specifications,
      images: [
        {
          url: `https://placehold.co/800x800?text=${encodeURIComponent(p.name)}`,
          thumbnail: `https://placehold.co/200x200?text=${encodeURIComponent(p.name)}`,
          mobile: `https://placehold.co/400x400?text=${encodeURIComponent(p.name)}`,
          alt: p.name,
        },
      ],
      isActive: true,
    })

    await product.save()
    log(`  Created product: ${p.name} (৳${p.price.toLocaleString()})`)
    productCount++
  }

  // -------------------------------------------------------------------------
  // 5. Create homepage promotions
  // -------------------------------------------------------------------------
  const homepagePromotions = [
    {
      title: 'Mega Brand Sale',
      subtitle: 'Up to 70% off on fashion and electronics',
      description: 'Shop best-selling items across categories with limited-time discounts.',
      image: 'https://placehold.co/1000x500/ff6f00/ffffff?text=Mega+Brand+Sale',
      actionText: 'Shop Brands',
      actionUrl: '/products',
      section: 'carousel',
      order: 0,
    },
    {
      title: 'Daily Flash Deals',
      subtitle: 'Discounts updated every hour',
      description: 'Discover trending flash offers for your favorite categories.',
      image: 'https://placehold.co/1000x500/0d47a1/ffffff?text=Daily+Flash+Deals',
      actionText: 'See Today’s Offers',
      actionUrl: '/products',
      section: 'carousel',
      order: 1,
    },
    {
      title: 'Top Rated Picks',
      subtitle: 'Popular products curated for you',
      description: 'Explore top-rated items loved by customers in Bangladesh.',
      image: 'https://placehold.co/1000x500/1e88e5/ffffff?text=Top+Rated+Picks',
      actionText: 'Browse Top Picks',
      actionUrl: '/products',
      section: 'carousel',
      order: 2,
    },
    {
      title: 'Free Delivery',
      subtitle: 'On orders above ৳2,000',
      image: 'https://placehold.co/640x480/00897b/ffffff?text=Free+Delivery',
      section: 'ad',
      order: 0,
    },
    {
      title: 'Easy Returns',
      subtitle: '7-day return policy',
      image: 'https://placehold.co/640x480/7b1fa2/ffffff?text=Easy+Returns',
      section: 'ad',
      order: 1,
    },
    {
      title: 'Best Seller',
      subtitle: 'Trending products daily',
      image: 'https://placehold.co/640x480/283593/ffffff?text=Best+Seller',
      section: 'ad',
      order: 2,
    },
    {
      title: 'Flash Sale — Up to 70% OFF',
      description: 'Limited time deals on top brands',
      image: 'https://placehold.co/800x400/0d47a1/ffffff?text=Flash+Sale',
      actionText: 'Shop Deals',
      actionUrl: '/products',
      section: 'banner',
      order: 0,
    },
    {
      title: 'Daily Essentials',
      description: 'Everything you need for home and family',
      image: 'https://placehold.co/800x400/1976d2/ffffff?text=Daily+Essentials',
      actionText: 'Browse Now',
      actionUrl: '/products',
      section: 'banner',
      order: 1,
    },
  ]

  await HomePromotion.insertMany(homepagePromotions.map((item) => ({
    ...item,
    isActive: true,
  })))
  log(`  Created ${homepagePromotions.length} homepage promotions.`)

  // -------------------------------------------------------------------------
  // 5. Summary
  // -------------------------------------------------------------------------
  log('─────────────────────────────────────────')
  log('Seed completed successfully!')
  log(`  Admin user : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  log(`  Categories : ${nameToId.size}`)
  log(`  Products   : ${productCount}`)
  log('─────────────────────────────────────────')

  await mongoose.disconnect()
  log('Disconnected from MongoDB.')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seed().catch((err) => {
  console.error('[seed] Fatal error:', err)
  process.exit(1)
})
