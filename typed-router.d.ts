/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// Generated by unplugin-vue-router. ‼️ DO NOT MODIFY THIS FILE ‼️
// It's recommended to commit this file.
// Make sure to add this file to your tsconfig.json file as an "includes" or "files" entry.

declare module 'vue-router/auto-routes' {
  import type {
    RouteRecordInfo,
    ParamValue,
    ParamValueOneOrMore,
    ParamValueZeroOrMore,
    ParamValueZeroOrOne,
  } from 'vue-router'

  /**
   * Route name map generated by unplugin-vue-router
   */
  export interface RouteNamedMap {
    '//home.[[nik]]': RouteRecordInfo<'//home.[[nik]]', '/home/:nik?', { nik?: ParamValueZeroOrOne<true> }, { nik?: ParamValueZeroOrOne<false> }>,
    '/md/': RouteRecordInfo<'/md/', '/md', Record<never, never>, Record<never, never>>,
    '/md/editor/': RouteRecordInfo<'/md/editor/', '/md/editor', Record<never, never>, Record<never, never>>,
    '/md/examples': RouteRecordInfo<'/md/examples', '/md/examples', Record<never, never>, Record<never, never>>,
    '/md_[id].[[nik]]': RouteRecordInfo<'/md_[id].[[nik]]', '/md_:id/:nik?', { id: ParamValue<true>, nik?: ParamValueZeroOrOne<true> }, { id: ParamValue<false>, nik?: ParamValueZeroOrOne<false> }>,
    '/my/dashboard': RouteRecordInfo<'/my/dashboard', '/my/dashboard', Record<never, never>, Record<never, never>>,
    '/my/settings': RouteRecordInfo<'/my/settings', '/my/settings', Record<never, never>, Record<never, never>>,
  }
}
