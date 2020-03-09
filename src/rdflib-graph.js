const DataFactory = require('./data-factory')
const RDFQuery = require('./rdfquery')
const { xsd } = require('./namespaces')

/**
 * Creates a new RDFLibGraph wrapping a provided `Dataset` or creating
 * a new one if no dataset is provided
 *
 * @param store rdfjs Dataset object
 * @constructor
 */
class RDFLibGraph {
  constructor (options) {
    options = options || {}
    this.factory = new DataFactory(options.factory || require('@rdfjs/dataset'))
    this.store = options.dataset || this.factory.dataset()
  }

  find (s, p, o) {
    return new RDFLibGraphIterator(this.store, s, p, o)
  }

  query () {
    return RDFQuery(this)
  }

  loadGraph (graphURI, rdfModel) {
    postProcessGraph(this.store, graphURI, rdfModel, this.factory)
  }

  clear () {
    this.store = this.factory.dataset()
  }
}

class RDFLibGraphIterator {
  constructor (store, s, p, o) {
    this.index = 0
    // TODO: Could probably make a lazy iterator since Dataset is already an iterator
    this.ss = [...store.match(s, p, o)]
  }

  close () {
    // Do nothing
  }

  next () {
    if (this.index >= this.ss.length) {
      return null
    } else {
      return this.ss[this.index++]
    }
  }
}

function ensureBlankId (component) {
  if (component.termType === 'BlankNode') {
    if (typeof (component.value) !== 'string') {
      component.value = '_:' + component.id
    }
    return component
  }

  return component
}

function postProcessGraph (store, graphURI, newStore, factory) {
  const ss = newStore.match(undefined, undefined, undefined)
  for (const quad of ss) {
    const object = quad.object
    ensureBlankId(quad.subject)
    ensureBlankId(quad.predicate)
    ensureBlankId(quad.object)
    if (xsd.boolean.equals(object.datatype)) {
      if (object.value === '0' || object.value === 'false') {
        store.add(factory.quad(quad.subject, quad.predicate, factory.term('false'), graphURI))
      } else if (object.value === '1' || object.value === 'true') {
        store.add(factory.quad(quad.subject, quad.predicate, factory.term('true'), graphURI))
      } else {
        store.add(factory.quad(quad.subject, quad.predicate, object, graphURI))
      }
    } else if (object.termType === 'collection') {
      const items = object.elements
      store.add(factory.quad(quad.subject, quad.predicate, createRDFListNode(store, items, 0, factory)))
    } else {
      store.add(factory.quad(quad.subject, quad.predicate, quad.object, graphURI))
    }
  }
}

function createRDFListNode (store, items, index, factory) {
  if (index >= items.length) {
    return factory.term('rdf:nil')
  } else {
    const bnode = factory.blankNode()
    store.add(factory.quad(bnode, factory.term('rdf:first'), items[index]))
    store.add(factory.quad(bnode, factory.term('rdf:rest'), createRDFListNode(store, items, index + 1, factory)))
    return bnode
  }
};

module.exports.RDFLibGraph = RDFLibGraph
module.exports.RDFLibGraphIterator = RDFLibGraphIterator
