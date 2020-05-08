// Gatsby supports TypeScript natively!
import {graphql, Link, PageProps} from 'gatsby'
import React from 'react'

import Bio from '../components/bio'
import Layout from '../components/layout'
import SEO from '../components/seo'
import {rhythm} from '../utils/typography'

type Data = {
  site: {
    siteMetadata: {
      title: string
    }
  }
  allEsaPost: {
    edges: {
      node: {
        number: number
        name: string
        created_at: string
      }
    }[]
  }
}

const BlogIndex = ({data, location}: PageProps<Data>) => {
  const siteTitle = data.site.siteMetadata.title
  const posts = data.allEsaPost.edges

  return (
    <Layout location={location} title={siteTitle}>
      <SEO title="All posts"/>
      <Bio/>
      {posts.map(({node}) => {
        const title = node.name
        return (
          <article key={node.number}>
            <header>
              <h3
                style={{
                  marginBottom: rhythm(1 / 4),
                }}
              >
                <Link style={{boxShadow: `none`}} to={`/posts/${node.number}`}>
                  {title}
                </Link>
              </h3>
              <small>{node.created_at}</small>
            </header>
            <section>
              {/*<p*/}
              {/*  dangerouslySetInnerHTML={{*/}
              {/*    __html: node.frontmatter.description || node.excerpt,*/}
              {/*  }}*/}
              {/*/>*/}
            </section>
          </article>
        )
      })}
    </Layout>
  )
}

export default BlogIndex

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allEsaPost(sort: {fields: created_at, order: DESC}) {
      edges {
        node {
          number
          name
          created_at
          created_by {
            name
            screen_name
            icon
          }
          body_html
          category
          tags
        }
      }
    }
  }
`
