export interface FormPresetNode {
  moduleId: string
  defaults?: Record<string, unknown>
  children?: FormPresetNode[]
}

export interface FormPreset {
  id: string
  name: string
  description: string
  root: FormPresetNode
}

function field(label: string, child: FormPresetNode): FormPresetNode {
  return {
    moduleId: 'base.container',
    defaults: { tag: 'div' },
    children: [
      {
        moduleId: 'base.label',
        defaults: { text: label, targetMode: 'auto', targetId: '' },
      },
      child,
    ],
  }
}

export const FORM_PRESETS: readonly FormPreset[] = [
  {
    id: 'contact',
    name: 'Contact form',
    description: 'Name, email, message, status messages, and submit.',
    root: {
      moduleId: 'base.form',
      defaults: {
        mode: 'cms',
        formId: 'contact',
        successBehavior: 'message',
        successMessage: 'Thanks. Your message was received.',
        honeypotName: 'company',
        minSubmitSeconds: 2,
      },
      children: [
        field('Name', {
          moduleId: 'base.input',
          defaults: {
            inputType: 'text',
            fieldId: 'name',
            name: 'name',
            autocomplete: 'name',
            required: true,
          },
        }),
        field('Email', {
          moduleId: 'base.input',
          defaults: {
            inputType: 'email',
            fieldId: 'email',
            name: 'email',
            autocomplete: 'email',
            required: true,
          },
        }),
        field('Message', {
          moduleId: 'base.textarea',
          defaults: {
            fieldId: 'message',
            name: 'message',
            rows: 5,
            required: true,
            maxLength: 2000,
          },
        }),
        {
          moduleId: 'base.form-message',
          defaults: { kind: 'success', text: '' },
        },
        {
          moduleId: 'base.form-message',
          defaults: { kind: 'error', text: '' },
        },
        {
          moduleId: 'base.submit',
          defaults: { label: 'Send' },
        },
      ],
    },
  },
  {
    id: 'newsletter',
    name: 'Newsletter signup',
    description: 'Email capture with status messages and submit.',
    root: {
      moduleId: 'base.form',
      defaults: {
        mode: 'cms',
        formId: 'newsletter',
        successBehavior: 'message',
        successMessage: 'Thanks. You are on the list.',
        honeypotName: 'company',
        minSubmitSeconds: 2,
      },
      children: [
        field('Email', {
          moduleId: 'base.input',
          defaults: {
            inputType: 'email',
            fieldId: 'email',
            name: 'email',
            autocomplete: 'email',
            required: true,
          },
        }),
        field('Consent', {
          moduleId: 'base.checkbox',
          defaults: {
            fieldId: 'consent',
            name: 'consent',
            value: 'yes',
            required: true,
          },
        }),
        {
          moduleId: 'base.form-message',
          defaults: { kind: 'success', text: '' },
        },
        {
          moduleId: 'base.form-message',
          defaults: { kind: 'error', text: '' },
        },
        {
          moduleId: 'base.submit',
          defaults: { label: 'Subscribe' },
        },
      ],
    },
  },
]
