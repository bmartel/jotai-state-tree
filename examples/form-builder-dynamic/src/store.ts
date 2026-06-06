import { types, Instance } from 'jotai-state-tree';

export const TextQuestion = types
  .model('TextQuestion', {
    id: types.identifier,
    type: types.literal('text'),
    label: types.string,
    required: types.optional(types.boolean, false),
    placeholder: types.optional(types.string, ''),
  })
  .actions((self) => ({
    setLabel(label: string) {
      self.label = label;
    },
    setRequired(req: boolean) {
      self.required = req;
    },
    setPlaceholder(ph: string) {
      self.placeholder = ph;
    },
  }));

export const NumberQuestion = types
  .model('NumberQuestion', {
    id: types.identifier,
    type: types.literal('number'),
    label: types.string,
    required: types.optional(types.boolean, false),
    min: types.maybe(types.number),
    max: types.maybe(types.number),
  })
  .actions((self) => ({
    setLabel(label: string) {
      self.label = label;
    },
    setRequired(req: boolean) {
      self.required = req;
    },
    setMin(min: number | undefined) {
      self.min = min;
    },
    setMax(max: number | undefined) {
      self.max = max;
    },
  }));

export const ChoiceQuestion = types
  .model('ChoiceQuestion', {
    id: types.identifier,
    type: types.literal('choice'),
    label: types.string,
    required: types.optional(types.boolean, false),
    options: types.optional(types.array(types.string), []),
  })
  .actions((self) => ({
    setLabel(label: string) {
      self.label = label;
    },
    setRequired(req: boolean) {
      self.required = req;
    },
    addOption(opt: string) {
      if (opt.trim()) self.options.push(opt.trim());
    },
    removeOption(index: number) {
      self.options.splice(index, 1);
    },
    updateOption(index: number, val: string) {
      self.options[index] = val;
    },
  }));

export const ToggleQuestion = types
  .model('ToggleQuestion', {
    id: types.identifier,
    type: types.literal('toggle'),
    label: types.string,
    required: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    setLabel(label: string) {
      self.label = label;
    },
    setRequired(req: boolean) {
      self.required = req;
    },
  }));

// Dispatcher-based Union Type
export const Question = types.union(
  {
    dispatcher: (snap: any) => {
      if (snap.type === 'text') return TextQuestion;
      if (snap.type === 'number') return NumberQuestion;
      if (snap.type === 'choice') return ChoiceQuestion;
      return ToggleQuestion;
    },
  },
  TextQuestion,
  NumberQuestion,
  ChoiceQuestion,
  ToggleQuestion
);

export const FormSection: any = types
  .model('FormSection', {
    id: types.identifier,
    title: types.string,
    questions: types.optional(types.array(Question), []),
    // Recursive Late Binding Type definition
    subsections: types.optional(types.array(types.late(() => FormSection)), []),
  })
  .actions((self: any) => ({
    setTitle(title: string) {
      self.title = title;
    },
    addQuestion(type: 'text' | 'number' | 'choice' | 'toggle') {
      const id = 'q_' + Math.random().toString(36).substring(2, 9);
      const label = `New ${type.toUpperCase()} Question`;
      
      if (type === 'text') {
        self.questions.push({ id, type, label, placeholder: 'Enter answer...' });
      } else if (type === 'number') {
        self.questions.push({ id, type, label });
      } else if (type === 'choice') {
        self.questions.push({ id, type, label, options: ['Option A', 'Option B'] });
      } else {
        self.questions.push({ id, type, label });
      }
    },
    removeQuestion(id: string) {
      const q = self.questions.find((x: any) => x.id === id);
      if (q) self.questions.remove(q);
    },
    addSubsection(title: string) {
      const id = 's_' + Math.random().toString(36).substring(2, 9);
      self.subsections.push({ id, title, questions: [], subsections: [] });
    },
    removeSubsection(id: string) {
      const sub = self.subsections.find((x: any) => x.id === id);
      if (sub) self.subsections.remove(sub);
    },
  }));

export const FormStore = types
  .model('FormStore', {
    title: types.string,
    rootSection: FormSection,
  })
  .views((self) => ({
    get validationErrors(): string[] {
      const errors: string[] = [];

      function validate(sec: any, path: string) {
        if (!sec.title.trim()) {
          errors.push(`Section "${path}" is missing a title.`);
        }
        sec.questions.forEach((q: any, i: number) => {
          const name = q.label.trim() || `Q${i + 1} (${q.type})`;
          if (!q.label.trim()) {
            errors.push(`Question in "${sec.title || path}" (Index ${i + 1}) is missing a label.`);
          }
          if (q.type === 'choice' && q.options.length < 2) {
            errors.push(`Choice Question "${name}" must have at least 2 options.`);
          }
        });
        sec.subsections.forEach((sub: any) => {
          validate(sub, `${path} > ${sub.title || 'Subsection'}`);
        });
      }

      validate(self.rootSection, 'Root');
      return errors;
    },
    get isValid() {
      return this.validationErrors.length === 0;
    },
  }))
  .actions((self) => ({
    setTitle(title: string) {
      self.title = title;
    },
  }));

export type IFormStore = Instance<typeof FormStore>;
export type IFormSection = Instance<typeof FormSection>;
