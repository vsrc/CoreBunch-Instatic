/**
 * Inbound api-call dispatch — routes each validated api-call from a plugin
 * worker to the appropriate host-side handler.
 *
 * A typed handler table maps each target to its named handler function in
 * `handlers/`. Each handler is responsible for permission checks, argument
 * coercion, and calling `replyApiOk` exactly once. The outer try/catch
 * converts any unhandled throw into a structured error reply so correlation
 * ids are never leaked.
 *
 * SECURITY: Each handler that grants privileged access calls
 * `assertHostPluginPermission` as the kernel-of-correctness check. The
 * VM-side bootstrap performs the same check synchronously (defense-in-depth),
 * but the host check is the authoritative one.
 */

import type { ValidatedApiCall } from '../protocol/apiCallSchema'
import type { DbClient } from '../../db/client'
import { hostPlugins, getDbForApi } from './registry'
import { replyApiError } from './apiReplies'
import type { HostPluginRecord } from './types'
import { handleRoutesRegister } from './handlers/routes'
import { handleHooksOn, handleHooksFilter, handleHooksEmit } from './handlers/hooks'
import { handleLoopsRegisterSource } from './handlers/loops'
import { handleStorageList, handleStorageCreate, handleStorageUpdate, handleStorageDelete } from './handlers/storage'
import { handleSettingsReplace } from './handlers/settings'
import { handleNetworkFetch, handleNetworkAbort } from './handlers/network'
import { handleScheduleRegister, handleScheduleCancel } from './handlers/schedule'
import { handleMediaRegisterStorageAdapter, handleMediaRegisterUrlTransformer, handleMediaRegisterVariantDelegate } from './handlers/media'
import { handleCryptoDigest, handleCryptoSignHmac } from './handlers/crypto'
import {
  handleContentEntriesCreate,
  handleContentEntriesCreateMany,
  handleContentEntriesDelete,
  handleContentEntriesDeleteMany,
  handleContentEntriesGet,
  handleContentEntriesGetBySlug,
  handleContentEntriesList,
  handleContentEntriesMoveTable,
  handleContentEntriesPublish,
  handleContentEntriesUpdate,
  handleContentEntriesUpdateMany,
  handleContentRepublishAll,
  handleContentSearch,
  handleContentSnapshot,
  handleContentTablesCreate,
  handleContentTablesGet,
  handleContentTablesList,
  handleContentTreeMutate,
  handleContentTreeRead,
  handleContentTreeReplace,
} from './handlers/content'

type ApiTarget = ValidatedApiCall['target']
type HostApiHandler<TTarget extends ApiTarget> = (
  msg: Extract<ValidatedApiCall, { target: TTarget }>,
  entry: HostPluginRecord,
  db: DbClient,
) => Promise<void>
type HostApiHandlerTable = { [Target in ApiTarget]: HostApiHandler<Target> }
type AnyHostApiHandler = (
  msg: ValidatedApiCall,
  entry: HostPluginRecord,
  db: DbClient,
) => Promise<void>

const apiHandlers = {
  'cms.routes.register': handleRoutesRegister,
  'cms.hooks.on': handleHooksOn,
  'cms.hooks.filter': handleHooksFilter,
  'cms.hooks.emit': handleHooksEmit,
  'cms.loops.registerSource': handleLoopsRegisterSource,
  'cms.storage.list': handleStorageList,
  'cms.storage.create': handleStorageCreate,
  'cms.storage.update': handleStorageUpdate,
  'cms.storage.delete': handleStorageDelete,
  'cms.settings.replace': handleSettingsReplace,
  'network.fetch': handleNetworkFetch,
  'network.abort': handleNetworkAbort,
  'cms.schedule.register': handleScheduleRegister,
  'cms.schedule.cancel': handleScheduleCancel,
  'cms.media.registerStorageAdapter': handleMediaRegisterStorageAdapter,
  'cms.media.registerUrlTransformer': handleMediaRegisterUrlTransformer,
  'cms.media.registerVariantDelegate': handleMediaRegisterVariantDelegate,
  'crypto.digest': handleCryptoDigest,
  'crypto.signHmac': handleCryptoSignHmac,
  'cms.content.tables.list': handleContentTablesList,
  'cms.content.tables.get': handleContentTablesGet,
  'cms.content.tables.create': handleContentTablesCreate,
  'cms.content.entries.list': handleContentEntriesList,
  'cms.content.entries.get': handleContentEntriesGet,
  'cms.content.entries.getBySlug': handleContentEntriesGetBySlug,
  'cms.content.entries.create': handleContentEntriesCreate,
  'cms.content.entries.update': handleContentEntriesUpdate,
  'cms.content.entries.delete': handleContentEntriesDelete,
  'cms.content.entries.publish': handleContentEntriesPublish,
  'cms.content.entries.moveTable': handleContentEntriesMoveTable,
  'cms.content.entries.createMany': handleContentEntriesCreateMany,
  'cms.content.entries.updateMany': handleContentEntriesUpdateMany,
  'cms.content.entries.deleteMany': handleContentEntriesDeleteMany,
  'cms.content.tree.read': handleContentTreeRead,
  'cms.content.tree.mutate': handleContentTreeMutate,
  'cms.content.tree.replace': handleContentTreeReplace,
  'cms.content.search': handleContentSearch,
  'cms.content.snapshot': handleContentSnapshot,
  'cms.content.republishAll': handleContentRepublishAll,
} satisfies HostApiHandlerTable

export async function dispatchApiCall(msg: ValidatedApiCall): Promise<void> {
  const db = getDbForApi()
  if (!db) {
    replyApiError(msg.pluginId, msg.correlationId, 'Plugin worker host has no DbClient configured')
    return
  }
  const entry = hostPlugins.get(msg.pluginId)
  if (!entry) {
    replyApiError(msg.pluginId, msg.correlationId, `Plugin "${msg.pluginId}" is not loaded`)
    return
  }

  try {
    const handler = apiHandlers[msg.target] as AnyHostApiHandler
    await handler(msg, entry, db)
  } catch (err) {
    replyApiError(msg.pluginId, msg.correlationId, err instanceof Error ? err.message : String(err))
  }
}
