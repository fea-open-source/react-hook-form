import * as React from 'react';
import attachEventListeners from './logic/attachEventListeners';
import transformToNestObject from './logic/transformToNestObject';
import focusOnErrorField from './logic/focusOnErrorField';
import findRemovedFieldAndRemoveListener from './logic/findRemovedFieldAndRemoveListener';
import getFieldsValues from './logic/getFieldsValues';
import getFieldValue from './logic/getFieldValue';
import shouldRenderBasedOnError from './logic/shouldRenderBasedOnError';
import validateField from './logic/validateField';
import assignWatchFields from './logic/assignWatchFields';
import skipValidation from './logic/skipValidation';
import getFieldArrayParentName from './logic/getFieldArrayParentName';
import deepEqual from './logic/deepEqual';
import isNameInFieldArray from './logic/isNameInFieldArray';
import isCheckBoxInput from './utils/isCheckBoxInput';
import isEmptyObject from './utils/isEmptyObject';
import isRadioInput from './utils/isRadioInput';
import isSelectInput from './utils/isSelectInput';
import isFileInput from './utils/isFileInput';
import isObject from './utils/isObject';
import { getPath } from './utils/getPath';
import isPrimitive from './utils/isPrimitive';
import isFunction from './utils/isFunction';
import isArray from './utils/isArray';
import isString from './utils/isString';
import isSameError from './utils/isSameError';
import isUndefined from './utils/isUndefined';
import onDomRemove from './utils/onDomRemove';
import get from './utils/get';
import set from './utils/set';
import unset from './utils/unset';
import modeChecker from './utils/validationModeChecker';
import isMultipleSelect from './utils/isMultipleSelect';
import unique from './utils/unique';
import isNullOrUndefined from './utils/isNullOrUndefined';
import isRadioOrCheckboxFunction from './utils/isRadioOrCheckbox';
import isHTMLElement from './utils/isHTMLElement';
import { EVENTS, UNDEFINED, VALIDATION_MODE } from './constants';
import {
  UseFormMethods,
  FieldValues,
  UnpackNestedValue,
  FieldName,
  InternalFieldName,
  FieldValue,
  FieldErrors,
  Field,
  FieldRefs,
  UseFormOptions,
  ValidationRules,
  SubmitHandler,
  FieldElement,
  FormStateProxy,
  ReadFormState,
  Ref,
  HandleChange,
  FieldError,
  RadioOrCheckboxOption,
  OmitResetState,
  DefaultValuesAtRender,
  FlatFieldErrors,
  NestedValue,
  SetValueConfig,
  ErrorOption,
  FormState,
} from './types/form';
import { LiteralToPrimitive, DeepPartial, NonUndefined } from './types/utils';

const isWindowUndefined = typeof window === UNDEFINED;
const isWeb =
  typeof document !== UNDEFINED &&
  !isWindowUndefined &&
  !isUndefined(window.HTMLElement);
const isProxyEnabled = isWeb ? 'Proxy' in window : typeof Proxy !== UNDEFINED;

export function useForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext extends object = object
>({
  mode = VALIDATION_MODE.onSubmit,
  reValidateMode = VALIDATION_MODE.onChange,
  resolver,
  context,
  defaultValues = {} as UnpackNestedValue<DeepPartial<TFieldValues>>,
  shouldFocusError = true,
  shouldUnregister = true,
  criteriaMode,
}: UseFormOptions<TFieldValues, TContext> = {}): UseFormMethods<TFieldValues> {
  const fieldsRef = React.useRef<FieldRefs<TFieldValues>>({});
  const errorsRef = React.useRef<FieldErrors<TFieldValues>>({});
  const fieldArrayDefaultValues = React.useRef<Record<string, unknown[]>>({});
  const watchFieldsRef = React.useRef(
    new Set<InternalFieldName<TFieldValues>>(),
  );
  const watchFieldsHookRef = React.useRef<
    Record<string, Set<InternalFieldName<TFieldValues>>>
  >({});
  const watchFieldsHookRenderRef = React.useRef<Record<string, Function>>({});
  const fieldsWithValidationRef = React.useRef(
    new Set<InternalFieldName<TFieldValues>>(),
  );
  const validFieldsRef = React.useRef(
    new Set<InternalFieldName<TFieldValues>>(),
  );
  const defaultValuesRef = React.useRef<
    | FieldValue<UnpackNestedValue<TFieldValues>>
    | UnpackNestedValue<DeepPartial<TFieldValues>>
  >(defaultValues);
  const defaultValuesAtRenderRef = React.useRef(
    {} as DefaultValuesAtRender<TFieldValues>,
  );
  const isUnMount = React.useRef(false);
  const isWatchAllRef = React.useRef(false);
  const onChangeRef = React.useRef<HandleChange>();
  const unmountFieldsStateRef = React.useRef<Record<string, any>>({});
  const resetFieldArrayFunctionRef = React.useRef<Record<string, () => void>>(
    {},
  );
  const contextRef = React.useRef(context);
  const resolverRef = React.useRef(resolver);
  const fieldArrayNamesRef = React.useRef<Set<string>>(new Set());
  const [, render] = React.useState();
  const modeRef = React.useRef(modeChecker(mode));
  const {
    current: { isOnSubmit, isOnAll },
  } = modeRef;
  const isValidateAllFieldCriteria = criteriaMode === VALIDATION_MODE.all;
  const [formState, setFormState] = React.useState<FormState<TFieldValues>>({
    isDirty: false,
    dirtyFields: {},
    isSubmitted: false,
    submitCount: 0,
    touched: {},
    isSubmitting: false,
    isValid: !isOnSubmit,
    errors: {},
  });
  const readFormStateRef = React.useRef<ReadFormState>({
    isDirty: !isProxyEnabled,
    dirtyFields: !isProxyEnabled,
    isSubmitted: isOnSubmit,
    submitCount: !isProxyEnabled,
    touched: !isProxyEnabled,
    isSubmitting: !isProxyEnabled,
    isValid: !isProxyEnabled,
    errors: !isProxyEnabled,
  });
  const formStateRef = React.useRef(formState);
  const {
    current: { isOnBlur: isReValidateOnBlur, isOnChange: isReValidateOnChange },
  } = React.useRef(modeChecker(reValidateMode));

  contextRef.current = context;
  resolverRef.current = resolver;
  formStateRef.current = formState;
  errorsRef.current = formState.errors;

  const reRender = React.useCallback(
    () => !isUnMount.current && render({}),
    [],
  );

  const updateFormState = React.useCallback(
    (state: Partial<FormState<TFieldValues>>): void => {
      !isUnMount.current &&
        setFormState({
          ...formStateRef.current,
          ...state,
        });
    },
    [formState],
  );

  const shouldRenderBaseOnError = React.useCallback(
    (
      name: InternalFieldName<TFieldValues>,
      error: FlatFieldErrors<TFieldValues>,
      shouldRender: boolean | null = false,
      dirtyValues?: any,
      isValid?: boolean,
    ): boolean | void => {
      let shouldReRender =
        shouldRender ||
        shouldRenderBasedOnError<TFieldValues>({
          errors: formStateRef.current.errors,
          error,
          name,
          validFields: validFieldsRef.current,
          fieldsWithValidation: fieldsWithValidationRef.current,
        });
      const previousError = get(formStateRef.current.errors, name);

      if (isEmptyObject(error)) {
        if (fieldsWithValidationRef.current.has(name) || resolverRef.current) {
          validFieldsRef.current.add(name);
          shouldReRender = shouldReRender || previousError;
        }

        unset(formState.errors, name);
      } else {
        validFieldsRef.current.delete(name);
        shouldReRender =
          shouldReRender ||
          !previousError ||
          !isSameError(previousError, error[name] as FieldError);

        set(formStateRef.current.errors, name, error[name]);
      }

      if (shouldReRender || dirtyValues) {
        updateFormState({
          ...(dirtyValues || {}),
          errors: formStateRef.current.errors,
          isValid: resolver
            ? isValid
            : validFieldsRef.current.size >=
                fieldsWithValidationRef.current.size &&
              isEmptyObject(formStateRef.current.errors),
        });
      }
    },
    [],
  );

  const setFieldValue = React.useCallback(
    (
      { ref, options }: Field,
      rawValue:
        | FieldValue<TFieldValues>
        | UnpackNestedValue<DeepPartial<TFieldValues>>
        | undefined
        | null
        | boolean,
    ) => {
      const value =
        isWeb && isHTMLElement(ref) && isNullOrUndefined(rawValue)
          ? ''
          : rawValue;

      if (isRadioInput(ref) && options) {
        options.forEach(
          ({ ref: radioRef }: { ref: HTMLInputElement }) =>
            (radioRef.checked = radioRef.value === value),
        );
      } else if (isFileInput(ref) && !isString(value)) {
        ref.files = value as FileList;
      } else if (isMultipleSelect(ref)) {
        [...ref.options].forEach(
          (selectRef) =>
            (selectRef.selected = (value as string).includes(selectRef.value)),
        );
      } else if (isCheckBoxInput(ref) && options) {
        options.length > 1
          ? options.forEach(
              ({ ref: checkboxRef }) =>
                (checkboxRef.checked = String(
                  value as string | boolean,
                ).includes(checkboxRef.value)),
            )
          : (options[0].ref.checked = !!value);
      } else {
        ref.value = value;
      }
    },
    [],
  );

  const updateDirtyState = React.useCallback(
    (name: InternalFieldName<TFieldValues>, shouldUpdateState?: boolean) => {
      const { isDirty, dirtyFields } = readFormStateRef.current;

      if (!fieldsRef.current[name] || (!isDirty && !dirtyFields)) {
        return false;
      }

      const isFieldDirty =
        defaultValuesAtRenderRef.current[name] !==
        getFieldValue(fieldsRef, name, unmountFieldsStateRef);
      const isDirtyFieldExist = get(formStateRef.current.dirtyFields, name);
      const isFieldArray = isNameInFieldArray(fieldArrayNamesRef.current, name);
      const previousIsDirty = formStateRef.current.isDirty;

      if (isFieldDirty) {
        set(formStateRef.current.dirtyFields, name, true);
      } else {
        unset(formStateRef.current.dirtyFields, name);
      }

      const dirty =
        (isFieldArray &&
          !deepEqual(
            get(getValues(), getFieldArrayParentName(name)),
            get(defaultValuesRef.current, getFieldArrayParentName(name)),
          )) ||
        !isEmptyObject(formStateRef.current.dirtyFields);

      const values = {
        isDirty: dirty,
        dirtyFields: formStateRef.current.dirtyFields,
      };

      if (shouldUpdateState) {
        updateFormState({
          ...values,
        });
      }

      return (
        ((isDirty && previousIsDirty !== dirty) ||
          (dirtyFields &&
            isDirtyFieldExist !==
              get(formStateRef.current.dirtyFields, name))) &&
        values
      );
    },
    [],
  );

  const executeValidation = React.useCallback(
    async (
      name: InternalFieldName<TFieldValues>,
      skipReRender?: boolean,
    ): Promise<boolean> => {
      if (fieldsRef.current[name]) {
        const error = await validateField<TFieldValues>(
          fieldsRef,
          isValidateAllFieldCriteria,
          fieldsRef.current[name] as Field,
          unmountFieldsStateRef,
        );

        shouldRenderBaseOnError(name, error, skipReRender ? null : false);

        return isEmptyObject(error);
      }

      return false;
    },
    [shouldRenderBaseOnError, isValidateAllFieldCriteria],
  );

  const executeSchemaOrResolverValidation = React.useCallback(
    async (
      payload:
        | InternalFieldName<TFieldValues>
        | InternalFieldName<TFieldValues>[],
    ) => {
      const { errors } = await resolverRef.current!(
        getValues() as TFieldValues,
        contextRef.current,
        isValidateAllFieldCriteria,
      );
      const previousFormIsValid = formStateRef.current.isValid;
      const currentIsValid = isEmptyObject(errors);

      if (isArray(payload)) {
        const isInputsValid = payload
          .map((name) => {
            const error = get(errors, name);

            if (error) {
              set(formState.errors, name, error);
            } else {
              unset(formState.errors, name);
            }

            return !error;
          })
          .every(Boolean);

        updateFormState({
          isValid: isInputsValid,
          errors: formState.errors,
        });

        return isInputsValid;
      } else {
        const error = get(errors, payload);

        shouldRenderBaseOnError(
          payload,
          (error ? { [payload]: error } : {}) as FlatFieldErrors<TFieldValues>,
          previousFormIsValid !== currentIsValid,
        );

        return !error;
      }
    },
    [shouldRenderBaseOnError, isValidateAllFieldCriteria],
  );

  const trigger = React.useCallback(
    async (
      name?: FieldName<TFieldValues> | FieldName<TFieldValues>[],
    ): Promise<boolean> => {
      const fields = name || Object.keys(fieldsRef.current);

      if (resolverRef.current) {
        return executeSchemaOrResolverValidation(fields);
      }

      if (isArray(fields)) {
        const result = await Promise.all(
          fields.map(async (data) => await executeValidation(data, true)),
        );
        reRender();
        return result.every(Boolean);
      }

      return await executeValidation(fields);
    },
    [executeSchemaOrResolverValidation, executeValidation],
  );

  const setInternalValues = React.useCallback(
    (
      name: InternalFieldName<TFieldValues>,
      value: FieldValue<TFieldValues>,
      { shouldDirty, shouldValidate }: SetValueConfig,
    ) => {
      getPath(name, value).forEach((fieldName) => {
        const data = {};
        const field = fieldsRef.current[fieldName];

        if (field) {
          set(data, name, value);
          setFieldValue(field, get(data, fieldName));

          if (shouldDirty) {
            updateDirtyState(fieldName, true);
          }

          if (shouldValidate) {
            trigger(fieldName as FieldName<TFieldValues>);
          }
        }
      });
    },
    [trigger, setFieldValue, updateDirtyState],
  );

  const setInternalValue = React.useCallback(
    (
      name: InternalFieldName<TFieldValues>,
      value: FieldValue<TFieldValues> | null | undefined | boolean,
      config: SetValueConfig,
    ): boolean | void => {
      if (fieldsRef.current[name]) {
        setFieldValue(fieldsRef.current[name] as Field, value);
        return config.shouldDirty && !!updateDirtyState(name, true);
      } else if (!isPrimitive(value)) {
        setInternalValues(name, value, config);
      }

      if (!shouldUnregister) {
        unmountFieldsStateRef.current[name] = value;
      }

      return true;
    },
    [updateDirtyState, setFieldValue, setInternalValues],
  );

  const isFieldWatched = (name: string) =>
    isWatchAllRef.current ||
    watchFieldsRef.current.has(name) ||
    watchFieldsRef.current.has((name.match(/\w+/) || [])[0]);

  const renderWatchedInputs = (name: string, found = true): boolean => {
    if (!isEmptyObject(watchFieldsHookRef.current)) {
      for (const key in watchFieldsHookRef.current) {
        if (
          name === '' ||
          watchFieldsHookRef.current[key].has(name) ||
          watchFieldsHookRef.current[key].has(getFieldArrayParentName(name)) ||
          !watchFieldsHookRef.current[key].size
        ) {
          watchFieldsHookRenderRef.current[key]();
          found = false;
        }
      }
    }

    return found;
  };

  function setValue<
    TFieldName extends string,
    TFieldValue extends TFieldValues[TFieldName]
  >(
    name: TFieldName,
    value: NonUndefined<TFieldValue> extends NestedValue<infer U>
      ? U
      : UnpackNestedValue<DeepPartial<LiteralToPrimitive<TFieldValue>>>,
    config: SetValueConfig = {},
  ): void {
    setInternalValue(name, value as TFieldValues[string], config);

    renderWatchedInputs(name);

    if (isFieldWatched(name)) {
      reRender();
    }

    if (config.shouldValidate) {
      trigger(name as any);
    }
  }

  onChangeRef.current = onChangeRef.current
    ? onChangeRef.current
    : async ({ type, target }: Event): Promise<void | boolean> => {
        const name = (target as Ref)!.name;
        const field = fieldsRef.current[name];
        let error: FlatFieldErrors<TFieldValues>;
        let isValid;

        if (field) {
          const isBlurEvent = type === EVENTS.BLUR;
          const shouldSkipValidation =
            !isOnAll &&
            skipValidation({
              isBlurEvent,
              isReValidateOnChange,
              isReValidateOnBlur,
              isSubmitted: formStateRef.current.isSubmitted,
              ...modeRef.current,
            });
          const dirtyValues = updateDirtyState(name);
          let shouldRender = !!dirtyValues || isFieldWatched(name);

          if (
            isBlurEvent &&
            !get(formStateRef.current.touched, name) &&
            readFormStateRef.current.touched
          ) {
            set(formStateRef.current.touched, name, true);
            updateFormState({
              touched: formStateRef.current.touched,
            });
          }

          if (shouldSkipValidation) {
            renderWatchedInputs(name);
            if (dirtyValues) {
              return updateFormState({
                ...dirtyValues,
              });
            } else {
              return shouldRender && reRender();
            }
          }

          if (resolverRef.current) {
            const { errors } = await resolverRef.current(
              getValues() as TFieldValues,
              contextRef.current,
              isValidateAllFieldCriteria,
            );
            const previousFormIsValid = !!formStateRef.current.isValid;

            error = (get(errors, name)
              ? { [name]: get(errors, name) }
              : {}) as FlatFieldErrors<TFieldValues>;

            if (previousFormIsValid !== isEmptyObject(errors)) {
              shouldRender = true;
            }
          } else {
            error = await validateField<TFieldValues>(
              fieldsRef,
              isValidateAllFieldCriteria,
              field,
              unmountFieldsStateRef,
            );
          }

          renderWatchedInputs(name);
          shouldRenderBaseOnError(
            name,
            error,
            shouldRender,
            dirtyValues,
            isValid,
          );
        }
      };

  function getValues(): UnpackNestedValue<TFieldValues>;
  function getValues<TFieldName extends string, TFieldValue extends unknown>(
    name: TFieldName,
  ): TFieldName extends keyof TFieldValues
    ? UnpackNestedValue<TFieldValues>[TFieldName]
    : TFieldValue;
  function getValues<TFieldName extends keyof TFieldValues>(
    names: TFieldName[],
  ): UnpackNestedValue<Pick<TFieldValues, TFieldName>>;
  function getValues(payload?: string | string[]): unknown {
    if (isString(payload)) {
      return getFieldValue(fieldsRef, payload, unmountFieldsStateRef);
    }

    if (isArray(payload)) {
      return payload.reduce(
        (previous, name) => ({
          ...previous,
          [name]: getFieldValue(fieldsRef, name, unmountFieldsStateRef),
        }),
        {},
      );
    }

    return getFieldsValues(fieldsRef, unmountFieldsStateRef);
  }

  const validateResolver = React.useCallback(
    async (values = {}) => {
      const { errors } = await resolverRef.current!(
        {
          ...defaultValuesRef.current,
          ...getValues(),
          ...values,
        },
        contextRef.current,
        isValidateAllFieldCriteria,
      );
      const previousFormIsValid = formStateRef.current.isValid;
      const isValid = isEmptyObject(errors);

      if (previousFormIsValid !== isValid) {
        updateFormState({
          isValid,
        });
      }
    },
    [isValidateAllFieldCriteria],
  );

  const removeFieldEventListener = React.useCallback(
    (field: Field, forceDelete?: boolean) =>
      findRemovedFieldAndRemoveListener(
        fieldsRef,
        onChangeRef.current!,
        field,
        unmountFieldsStateRef,
        shouldUnregister,
        forceDelete,
      ),
    [shouldUnregister],
  );

  const removeFieldEventListenerAndRef = React.useCallback(
    (field: Field | undefined, forceDelete?: boolean) => {
      if (
        field &&
        (!isNameInFieldArray(fieldArrayNamesRef.current, field.ref.name) ||
          forceDelete)
      ) {
        removeFieldEventListener(field, forceDelete);

        if (shouldUnregister) {
          [defaultValuesAtRenderRef].forEach((data) =>
            unset(data.current, field.ref.name),
          );

          [fieldsWithValidationRef, validFieldsRef].forEach((data) =>
            data.current.delete(field.ref.name),
          );

          const errorsCopy = formState.errors;
          unset(errorsCopy, field.ref.name);

          updateFormState({
            errors: errorsCopy,
          });

          if (
            readFormStateRef.current.isValid ||
            readFormStateRef.current.touched ||
            readFormStateRef.current.isDirty
          ) {
            unset(formStateRef.current.dirtyFields, field.ref.name);
            unset(formStateRef.current.touched, field.ref.name);

            updateFormState({
              isDirty: !isEmptyObject(formStateRef.current.dirtyFields),
              dirtyFields: formStateRef.current.dirtyFields,
              touched: formStateRef.current.touched,
            });

            if (resolverRef.current) {
              validateResolver();
            }
          }
        }
      }
    },
    [validateResolver, removeFieldEventListener],
  );

  function clearErrors(
    name?: FieldName<TFieldValues> | FieldName<TFieldValues>[],
  ): void {
    if (name) {
      (isArray(name) ? name : [name]).forEach((inputName) =>
        unset(formState.errors, inputName),
      );
      updateFormState({
        errors: formState.errors,
      });
    } else {
      updateFormState({
        errors: {},
      });
    }
  }

  function setError(name: FieldName<TFieldValues>, error: ErrorOption): void {
    set(formState.errors, name, {
      ...error,
      ref: (fieldsRef.current[name] || {})!.ref,
    });

    updateFormState({
      isValid: false,
      errors: formState.errors,
    });
  }

  const watchInternal = React.useCallback(
    (
      fieldNames?: string | string[],
      defaultValue?: unknown,
      watchId?: string,
    ) => {
      const watchFields = watchId
        ? watchFieldsHookRef.current[watchId]
        : watchFieldsRef.current;
      const combinedDefaultValues = isUndefined(defaultValue)
        ? defaultValuesRef.current
        : defaultValue;
      const fieldValues = getFieldsValues<TFieldValues>(
        fieldsRef,
        unmountFieldsStateRef,
        fieldNames,
      );

      if (isString(fieldNames)) {
        return assignWatchFields<TFieldValues>(
          fieldValues,
          fieldNames,
          watchFields,
          isUndefined(defaultValue)
            ? get(combinedDefaultValues, fieldNames)
            : (defaultValue as UnpackNestedValue<DeepPartial<TFieldValues>>),
          true,
        );
      }

      if (isArray(fieldNames)) {
        return fieldNames.reduce(
          (previous, name) => ({
            ...previous,
            [name]: assignWatchFields<TFieldValues>(
              fieldValues,
              name,
              watchFields,
              combinedDefaultValues as UnpackNestedValue<
                DeepPartial<TFieldValues>
              >,
            ),
          }),
          {},
        );
      }

      if (isUndefined(watchId)) {
        isWatchAllRef.current = true;
      }

      return transformToNestObject(
        (!isEmptyObject(fieldValues) && fieldValues) ||
          (combinedDefaultValues as FieldValues),
      );
    },
    [],
  );

  function watch(): UnpackNestedValue<TFieldValues>;
  function watch<
    TFieldName extends string,
    TFieldValue extends TFieldValues[TFieldName]
  >(
    name: TFieldName,
    defaultValue?: UnpackNestedValue<LiteralToPrimitive<TFieldValue>>,
  ): UnpackNestedValue<LiteralToPrimitive<TFieldValue>>;
  function watch<TFieldName extends keyof TFieldValues>(
    names: TFieldName[],
    defaultValues?: UnpackNestedValue<
      DeepPartial<Pick<TFieldValues, TFieldName>>
    >,
  ): UnpackNestedValue<Pick<TFieldValues, TFieldName>>;
  function watch(
    names: string[],
    defaultValues?: UnpackNestedValue<DeepPartial<TFieldValues>>,
  ): UnpackNestedValue<DeepPartial<TFieldValues>>;
  function watch(
    fieldNames?: string | string[],
    defaultValue?: unknown,
  ): unknown {
    return watchInternal(fieldNames, defaultValue);
  }

  function unregister(
    name: FieldName<TFieldValues> | FieldName<TFieldValues>[],
  ): void {
    (isArray(name) ? name : [name]).forEach((fieldName) =>
      removeFieldEventListenerAndRef(fieldsRef.current[fieldName], true),
    );
  }

  function registerFieldRef<TFieldElement extends FieldElement<TFieldValues>>(
    ref: TFieldElement & Ref,
    validateOptions: ValidationRules | null = {},
  ): ((name: InternalFieldName<TFieldValues>) => void) | void {
    if (process.env.NODE_ENV !== 'production') {
      if (!ref.name) {
        return console.warn('📋 Field is missing `name` attribute:', ref);
      }

      if (
        fieldArrayNamesRef.current.has(ref.name.split(/\[\d+\]$/)[0]) &&
        !RegExp(
          `^${ref.name.split(/\[\d+\]$/)[0]}[\\d+]\.\\w+`
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]'),
        ).test(ref.name)
      ) {
        return console.warn(
          '📋 `name` prop should be in object shape: name="test[index].name". https://react-hook-form.com/api#useFieldArray',
        );
      }
    }

    const { name, type, value } = ref;
    const fieldRefAndValidationOptions = {
      ref,
      ...validateOptions,
    };
    const fields = fieldsRef.current;
    const isRadioOrCheckbox = isRadioOrCheckboxFunction(ref);
    let field = fields[name] as Field;
    let isEmptyDefaultValue = true;
    let isFieldArray;
    let defaultValue;

    if (
      field &&
      (isRadioOrCheckbox
        ? isArray(field.options) &&
          unique(field.options).find((option) => {
            return value === option.ref.value && option.ref === ref;
          })
        : ref === field.ref)
    ) {
      fields[name] = {
        ...field,
        ...validateOptions,
      };
      return;
    }

    if (type) {
      const mutationWatcher = onDomRemove(ref, () =>
        removeFieldEventListenerAndRef(field),
      );

      field = isRadioOrCheckbox
        ? {
            options: [
              ...unique((field && field.options) || []),
              {
                ref,
                mutationWatcher,
              } as RadioOrCheckboxOption,
            ],
            ref: { type, name },
            ...validateOptions,
          }
        : {
            ...fieldRefAndValidationOptions,
            mutationWatcher,
          };
    } else {
      field = fieldRefAndValidationOptions;
    }

    fields[name] = field;

    const isEmptyUnmountFields = isUndefined(
      get(unmountFieldsStateRef.current, name),
    );

    if (!isEmptyObject(defaultValuesRef.current) || !isEmptyUnmountFields) {
      defaultValue = get(
        isEmptyUnmountFields
          ? defaultValuesRef.current
          : unmountFieldsStateRef.current,
        name,
      );
      isEmptyDefaultValue = isUndefined(defaultValue);
      isFieldArray = isNameInFieldArray(fieldArrayNamesRef.current, name);

      if (!isEmptyDefaultValue && !isFieldArray) {
        setFieldValue(field, defaultValue);
      }
    }

    if (resolver && !isFieldArray && readFormStateRef.current.isValid) {
      validateResolver();
    } else if (!isEmptyObject(validateOptions)) {
      fieldsWithValidationRef.current.add(name);

      if (!isOnSubmit && readFormStateRef.current.isValid) {
        validateField(
          fieldsRef,
          isValidateAllFieldCriteria,
          field,
          unmountFieldsStateRef,
        ).then((error: FieldErrors) => {
          if (isEmptyObject(error)) {
            validFieldsRef.current.add(name);
          } else if (formStateRef.current.isValid) {
            updateFormState({
              isValid: false,
            });
          }
        });
      }
    }

    if (
      !defaultValuesAtRenderRef.current[name] &&
      !(isFieldArray && isEmptyDefaultValue)
    ) {
      const fieldValue = getFieldValue(fieldsRef, name, unmountFieldsStateRef);
      defaultValuesAtRenderRef.current[name] = isEmptyDefaultValue
        ? isObject(fieldValue)
          ? { ...fieldValue }
          : fieldValue
        : defaultValue;
    }

    if (type) {
      attachEventListeners(
        isRadioOrCheckbox && field.options
          ? field.options[field.options.length - 1]
          : field,
        isRadioOrCheckbox || isSelectInput(ref),
        onChangeRef.current,
      );
    }
  }

  function register<TFieldElement extends FieldElement<TFieldValues>>(
    rules?: ValidationRules,
  ): (ref: (TFieldElement & Ref) | null) => void;
  function register(
    name: FieldName<TFieldValues>,
    rules?: ValidationRules,
  ): void;
  function register<TFieldElement extends FieldElement<TFieldValues>>(
    ref: (TFieldElement & Ref) | null,
    rules?: ValidationRules,
  ): void;
  function register<TFieldElement extends FieldElement<TFieldValues>>(
    refOrValidationOptions?:
      | FieldName<TFieldValues>
      | ValidationRules
      | (TFieldElement & Ref)
      | null,
    rules?: ValidationRules,
  ): ((ref: (TFieldElement & Ref) | null) => void) | void {
    if (!isWindowUndefined) {
      if (isString(refOrValidationOptions)) {
        registerFieldRef({ name: refOrValidationOptions }, rules);
      } else if (
        isObject(refOrValidationOptions) &&
        'name' in refOrValidationOptions
      ) {
        registerFieldRef(refOrValidationOptions, rules);
      } else {
        return (ref: (TFieldElement & Ref) | null) =>
          ref && registerFieldRef(ref, refOrValidationOptions);
      }
    }
  }

  const handleSubmit = React.useCallback(
    <TSubmitFieldValues extends FieldValues = TFieldValues>(
      callback: SubmitHandler<TSubmitFieldValues>,
    ) => async (e?: React.BaseSyntheticEvent): Promise<void> => {
      if (e && e.preventDefault) {
        e.preventDefault();
        e.persist();
      }
      let fieldErrors: FieldErrors<TFieldValues> = {};
      let fieldValues: FieldValues = getFieldsValues(
        fieldsRef,
        unmountFieldsStateRef,
      );

      if (readFormStateRef.current.isSubmitting) {
        updateFormState({
          isSubmitting: true,
        });
      }

      try {
        if (resolverRef.current) {
          const { errors, values } = await resolverRef.current(
            fieldValues as TFieldValues,
            contextRef.current,
            isValidateAllFieldCriteria,
          );
          formState.errors = errors;
          fieldErrors = errors;
          fieldValues = values;
        } else {
          for (const field of Object.values(fieldsRef.current)) {
            if (field) {
              const {
                ref: { name },
              } = field;

              const fieldError = await validateField(
                fieldsRef,
                isValidateAllFieldCriteria,
                field,
                unmountFieldsStateRef,
              );

              if (fieldError[name]) {
                set(fieldErrors, name, fieldError[name]);
                validFieldsRef.current.delete(name);
              } else if (fieldsWithValidationRef.current.has(name)) {
                unset(formState.errors, name);
                validFieldsRef.current.add(name);
              }
            }
          }
        }

        if (
          isEmptyObject(fieldErrors) &&
          Object.keys(formState.errors).every((name) =>
            Object.keys(fieldsRef.current).includes(name),
          )
        ) {
          updateFormState({
            errors: {},
          });
          await callback(
            fieldValues as UnpackNestedValue<TSubmitFieldValues>,
            e,
          );
        } else {
          formState.errors = {
            ...formState.errors,
            ...fieldErrors,
          };
          if (shouldFocusError) {
            focusOnErrorField(fieldsRef.current, fieldErrors);
          }
        }
      } finally {
        updateFormState({
          isSubmitted: true,
          isSubmitting: false,
          errors: formState.errors,
          submitCount: formStateRef.current.submitCount + 1,
        });
      }
    },
    [shouldFocusError, isValidateAllFieldCriteria],
  );

  const resetRefs = ({
    errors,
    isDirty,
    isSubmitted,
    touched,
    isValid,
    submitCount,
    dirtyFields,
  }: OmitResetState) => {
    if (!isValid) {
      validFieldsRef.current = new Set();
      fieldsWithValidationRef.current = new Set();
    }

    defaultValuesAtRenderRef.current = {} as DefaultValuesAtRender<
      TFieldValues
    >;
    fieldArrayDefaultValues.current = {};
    watchFieldsRef.current = new Set();
    isWatchAllRef.current = false;

    updateFormState({
      isDirty: isDirty ? formStateRef.current.isDirty : false,
      isSubmitted: isSubmitted ? formStateRef.current.isSubmitted : false,
      submitCount: submitCount ? formStateRef.current.submitCount : 0,
      isValid: isValid ? formStateRef.current.isValid : true,
      dirtyFields: dirtyFields ? formStateRef.current.dirtyFields : {},
      touched: touched ? formStateRef.current.touched : {},
      errors: errors ? formStateRef.current.errors : {},
    });
  };

  const reset = (
    values?: UnpackNestedValue<DeepPartial<TFieldValues>>,
    omitResetState: OmitResetState = {},
  ): void => {
    if (isWeb) {
      for (const field of Object.values(fieldsRef.current)) {
        if (field) {
          const { ref, options } = field;
          const inputRef =
            isRadioOrCheckboxFunction(ref) && isArray(options)
              ? options[0].ref
              : ref;

          if (isHTMLElement(inputRef)) {
            try {
              inputRef.closest('form')!.reset();
              break;
            } catch {}
          }
        }
      }
    }

    fieldsRef.current = {};

    defaultValuesRef.current = values || { ...defaultValuesRef.current };

    if (values) {
      renderWatchedInputs('');
    }

    unmountFieldsStateRef.current = shouldUnregister ? {} : values || {};

    Object.values(resetFieldArrayFunctionRef.current).forEach(
      (resetFieldArray) => isFunction(resetFieldArray) && resetFieldArray(),
    );

    resetRefs(omitResetState);
  };

  React.useEffect(() => {
    isUnMount.current = false;

    return () => {
      isUnMount.current = true;

      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      fieldsRef.current &&
        Object.values(fieldsRef.current).forEach((field) =>
          removeFieldEventListenerAndRef(field, true),
        );
    };
  }, [removeFieldEventListenerAndRef]);

  if (!resolver && readFormStateRef.current.isValid) {
    formState.isValid =
      validFieldsRef.current.size >= fieldsWithValidationRef.current.size &&
      isEmptyObject(formState.errors);
  }

  const commonProps = {
    trigger,
    setValue: React.useCallback(setValue, [setInternalValue, trigger]),
    getValues: React.useCallback(getValues, []),
    register: React.useCallback(register, [defaultValuesRef.current]),
    unregister: React.useCallback(unregister, []),
  };

  const control = {
    removeFieldEventListener,
    renderWatchedInputs,
    watchInternal,
    reRender,
    mode: modeRef.current,
    reValidateMode: {
      isReValidateOnBlur,
      isReValidateOnChange,
    },
    fieldsRef,
    isWatchAllRef,
    watchFieldsRef,
    resetFieldArrayFunctionRef,
    watchFieldsHookRef,
    watchFieldsHookRenderRef,
    fieldArrayDefaultValues,
    validFieldsRef,
    fieldsWithValidationRef,
    fieldArrayNamesRef,
    readFormStateRef,
    formStateRef,
    defaultValuesRef,
    unmountFieldsStateRef,
    updateFormState,
    validateSchemaIsValid: resolver ? validateResolver : undefined,
    ...commonProps,
  };

  return {
    watch,
    control,
    formState: isProxyEnabled
      ? new Proxy<FormStateProxy<TFieldValues>>(formState, {
          get: (obj, prop: keyof FormStateProxy) => {
            if (
              process.env.NODE_ENV !== 'production' &&
              prop === 'isValid' &&
              isOnSubmit
            ) {
              console.warn(
                '📋 `formState.isValid` is applicable with `onChange` or `onBlur` mode. https://react-hook-form.com/api#formState',
              );
            }

            if (prop in obj) {
              readFormStateRef.current[prop] = true;
              return obj[prop];
            }

            return undefined;
          },
        })
      : formState,
    handleSubmit,
    reset: React.useCallback(reset, []),
    clearErrors: React.useCallback(clearErrors, []),
    setError: React.useCallback(setError, []),
    errors: formState.errors,
    ...commonProps,
  };
}
