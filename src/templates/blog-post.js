import React from 'react'
import {graphql, Link} from 'gatsby'

import Bio from '../components/bio'
import Layout from '../components/layout'
import SEO from '../components/seo'
import {rhythm, scale} from '../utils/typography'

const BlogPostTemplate = ({data, pageContext, location}) => {
  const post = data.esaPost
  const siteTitle = data.site.siteMetadata.title
  const {previous, next} = pageContext

  return (
    <Layout location={location} title={siteTitle}>
      <SEO title={post.name}/>
      <article>
        <header>
          <h1
            style={{
              marginTop: rhythm(1),
              marginBottom: 0,
            }}
          >
            {post.name}
          </h1>
          <p
            style={{
              ...scale(-1 / 5),
              display: `block`,
              marginBottom: rhythm(1),
            }}
          >
            {post.created_at}
          </p>
        </header>
        <section dangerouslySetInnerHTML={{__html: post.body_html}}/>
        <hr
          style={{
            marginBottom: rhythm(1),
          }}
        />
        <footer>
          <Bio/>
        </footer>
      </article>

      <nav>
        <ul
          style={{
            display: `flex`,
            flexWrap: `wrap`,
            justifyContent: `space-between`,
            listStyle: `none`,
            padding: 0,
          }}
        >
          <li>
            {previous && (
              <Link to={`/posts/${previous.number}`} rel="next">
                ← {previous.title}
              </Link>
            )}
          </li>
          <li>
            {next && (
              <Link to={`/posts/${next.number}`} rel="next">
                {next.title} →
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </Layout>
  )
}

export default BlogPostTemplate

export const pageQuery = graphql`
  query BlogPostBySlug($number: Int!) {
    site {
      siteMetadata {
        title
      }
    }
    esaPost(number: { eq: $number }) {
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
`
