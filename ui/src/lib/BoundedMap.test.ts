import { describe, it, expect } from 'vitest'
import { BoundedMap } from './BoundedMap'

describe('BoundedMap', () => {
  describe('basic Map operations', () => {
    it('supports set and get', () => {
      const map = new BoundedMap<string, number>(10)
      map.set('a', 1)
      expect(map.get('a')).toBe(1)
    })

    it('supports has', () => {
      const map = new BoundedMap<string, number>(10)
      expect(map.has('a')).toBe(false)
      map.set('a', 1)
      expect(map.has('a')).toBe(true)
    })

    it('supports delete', () => {
      const map = new BoundedMap<string, number>(10)
      map.set('a', 1)
      map.delete('a')
      expect(map.has('a')).toBe(false)
      expect(map.size).toBe(0)
    })

    it('supports clear', () => {
      const map = new BoundedMap<string, number>(10)
      map.set('a', 1)
      map.set('b', 2)
      map.clear()
      expect(map.size).toBe(0)
      expect(map.has('a')).toBe(false)
      expect(map.has('b')).toBe(false)
    })

    it('returns the map instance from set (for chaining)', () => {
      const map = new BoundedMap<string, number>(10)
      const result = map.set('a', 1)
      expect(result).toBe(map)
    })

    it('overwrites existing values', () => {
      const map = new BoundedMap<string, number>(10)
      map.set('a', 1)
      map.set('a', 2)
      expect(map.get('a')).toBe(2)
      expect(map.size).toBe(1)
    })
  })

  describe('eviction', () => {
    it('evicts the oldest entry when maxSize is exceeded', () => {
      const map = new BoundedMap<string, number>(3)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)
      map.set('d', 4)

      expect(map.size).toBe(3)
      expect(map.has('a')).toBe(false)
      expect(map.get('b')).toBe(2)
      expect(map.get('c')).toBe(3)
      expect(map.get('d')).toBe(4)
    })

    it('evicts multiple entries when many are added past the limit', () => {
      const map = new BoundedMap<string, number>(2)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)
      map.set('d', 4)
      map.set('e', 5)

      expect(map.size).toBe(2)
      expect(map.has('a')).toBe(false)
      expect(map.has('b')).toBe(false)
      expect(map.has('c')).toBe(false)
      expect(map.get('d')).toBe(4)
      expect(map.get('e')).toBe(5)
    })

    it('does not evict when at exactly maxSize', () => {
      const map = new BoundedMap<string, number>(3)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)

      expect(map.size).toBe(3)
      expect(map.get('a')).toBe(1)
      expect(map.get('b')).toBe(2)
      expect(map.get('c')).toBe(3)
    })

    it('works with maxSize of 1', () => {
      const map = new BoundedMap<string, number>(1)
      map.set('a', 1)
      map.set('b', 2)

      expect(map.size).toBe(1)
      expect(map.has('a')).toBe(false)
      expect(map.get('b')).toBe(2)
    })
  })

  describe('updating existing keys', () => {
    it('moves an updated key to most-recent position', () => {
      const map = new BoundedMap<string, number>(3)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)

      // Update 'a' so it moves to the end
      map.set('a', 10)

      // Now 'b' is the oldest; adding a new entry should evict 'b', not 'a'
      map.set('d', 4)

      expect(map.size).toBe(3)
      expect(map.has('b')).toBe(false)
      expect(map.get('a')).toBe(10)
      expect(map.get('c')).toBe(3)
      expect(map.get('d')).toBe(4)
    })

    it('does not increase size when updating an existing key', () => {
      const map = new BoundedMap<string, number>(3)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)
      map.set('a', 100)

      expect(map.size).toBe(3)
    })
  })

  describe('constructor with initial entries', () => {
    it('accepts initial entries', () => {
      const map = new BoundedMap<string, number>(5, [
        ['a', 1],
        ['b', 2],
      ])
      expect(map.size).toBe(2)
      expect(map.get('a')).toBe(1)
      expect(map.get('b')).toBe(2)
    })

    it('evicts oldest initial entries when they exceed maxSize', () => {
      const map = new BoundedMap<string, number>(2, [
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
      ])

      expect(map.size).toBe(2)
      expect(map.has('a')).toBe(false)
      expect(map.has('b')).toBe(false)
      expect(map.get('c')).toBe(3)
      expect(map.get('d')).toBe(4)
    })

    it('works with no initial entries', () => {
      const map = new BoundedMap<string, number>(5)
      expect(map.size).toBe(0)
    })
  })

  describe('iteration order', () => {
    it('iterates keys in insertion order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('c', 3)
      map.set('a', 1)
      map.set('b', 2)

      expect([...map.keys()]).toEqual(['c', 'a', 'b'])
    })

    it('iterates values in insertion order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('c', 3)
      map.set('a', 1)
      map.set('b', 2)

      expect([...map.values()]).toEqual([3, 1, 2])
    })

    it('iterates entries in insertion order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('c', 3)
      map.set('a', 1)
      map.set('b', 2)

      expect([...map.entries()]).toEqual([
        ['c', 3],
        ['a', 1],
        ['b', 2],
      ])
    })

    it('reflects updated key position in iteration order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)

      // Update 'a' -- it should move to the end
      map.set('a', 10)

      expect([...map.keys()]).toEqual(['b', 'c', 'a'])
      expect([...map.values()]).toEqual([2, 3, 10])
    })

    it('forEach iterates in insertion order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('x', 10)
      map.set('y', 20)
      map.set('z', 30)

      const keys: string[] = []
      map.forEach((_value, key) => {
        keys.push(key)
      })

      expect(keys).toEqual(['x', 'y', 'z'])
    })

    it('spread into array produces entries in insertion order', () => {
      const map = new BoundedMap<string, number>(5)
      map.set('a', 1)
      map.set('b', 2)

      expect([...map]).toEqual([
        ['a', 1],
        ['b', 2],
      ])
    })
  })

  describe('maxSize property', () => {
    it('exposes the maxSize as a readonly property', () => {
      const map = new BoundedMap<string, number>(42)
      expect(map.maxSize).toBe(42)
    })

    it('maxSize does not change after operations', () => {
      const map = new BoundedMap<string, number>(3)
      map.set('a', 1)
      map.set('b', 2)
      map.set('c', 3)
      map.set('d', 4)
      map.delete('d')
      expect(map.maxSize).toBe(3)
    })
  })
})
