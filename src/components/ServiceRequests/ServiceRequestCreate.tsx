import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogItem, useCatalogItems } from '../../hooks/useCatalog';
import { useCreateServiceRequest } from '../../hooks/useServiceRequests';
import type { CatalogItem, Priority } from '../../types/index';
import {
  SNCollapsibleSection,
  SNPage,
  SNPillBadge,
  SNReadOnly,
  SNRecordField,
  SNRecordGrid,
  SNRecordHeader,
  sn,
} from '../ITSMTemplates/ServiceNowUI';

type FormValues = {
  catalogItemId: string;
  catalogItemName: string;
  category: string;
  estimatedDelivery: string;
  shortDescription: string;
  description: string;
  priority: Priority;
  quantity: string;
};

type SchemaField = {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<string | { label: string; value: string }>;
};

const PRIORITY_LABEL: Record<Priority, string> = {
  P1: '1 - CRITICAL',
  P2: '2 - HIGH',
  P3: '3 - MODERATE',
  P4: '4 - LOW',
};

function personLabel(user: any): string {
  const firstName = user?.firstName || user?.first_name || '';
  const lastName = user?.lastName || user?.last_name || '';
  return [firstName, lastName].filter(Boolean).join(' ').trim() || user?.email || user?.username || 'Current user';
}

function nowForHeader(): string {
  return new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function fieldsFromSchema(item?: CatalogItem): SchemaField[] {
  const schema = item?.formSchema as { fields?: SchemaField[] } | null | undefined;
  if (schema?.fields && Array.isArray(schema.fields) && schema.fields.length > 0) {
    return schema.fields;
  }
  return [
    { name: 'business_justification', label: 'Business justification', type: 'textarea', required: true },
    { name: 'needed_by', label: 'Needed by', type: 'date' },
    { name: 'request_details', label: 'Location, account, or user details', type: 'text' },
  ];
}

function optionValue(option: string | { label: string; value: string }) {
  return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: string | { label: string; value: string }) {
  return typeof option === 'string' ? option : option.label;
}

export default function ServiceRequestCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createRequest = useCreateServiceRequest();
  const { user: currentUser } = useAuth();

  const preselectedItemId = searchParams.get('item') ?? '';
  const [selectedItemId, setSelectedItemId] = useState(preselectedItemId);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const { data: itemsRes } = useCatalogItems({ limit: 200 });
  const { data: itemRes } = useCatalogItem(selectedItemId);

  const catalogItems: CatalogItem[] = itemsRes?.data ?? [];
  const selectedItem: CatalogItem | undefined =
    itemRes?.data ?? catalogItems.find((item) => item.id === selectedItemId);
  const schemaFields = useMemo(() => fieldsFromSchema(selectedItem), [selectedItem]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      catalogItemId: preselectedItemId,
      catalogItemName: '',
      category: '',
      estimatedDelivery: '',
      shortDescription: '',
      description: '',
      priority: 'P3',
      quantity: '1',
    },
  });

  const priority = watch('priority');
  const catalogItemName = watch('catalogItemName');

  useEffect(() => {
    if (!selectedItem || !selectedItemId) return;
    setValue('catalogItemName', selectedItem.name);
    setValue('category', selectedItem.category?.name || selectedItem.type || '');
    setValue('estimatedDelivery', selectedItem.estimatedDays ? `${selectedItem.estimatedDays} day(s)` : '');
  }, [selectedItem?.id, selectedItemId, setValue]);

  const syncCatalogItemText = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    const exactMatch = catalogItems.find((item) => item.name.trim().toLowerCase() === trimmed);
    if (!exactMatch) {
      setSelectedItemId('');
      setValue('catalogItemId', '');
      return;
    }

    setSelectedItemId(exactMatch.id);
    setValue('catalogItemId', exactMatch.id);
    setValue('category', exactMatch.category?.name || exactMatch.type || '');
    setValue('estimatedDelivery', exactMatch.estimatedDays ? `${exactMatch.estimatedDays} day(s)` : '');
    setVariables({});
  };

  const updateVariable = (name: string, value: string) => {
    setVariables((current) => ({ ...current, [name]: value }));
  };

  const onSubmit = async (values: FormValues) => {
    const catalogItemId = selectedItemId || values.catalogItemId || undefined;
    const typedCatalogItemName = values.catalogItemName?.trim();
    if (!typedCatalogItemName) {
      toast.error('Enter a catalog item');
      return;
    }

    const missingField = schemaFields.find((field) => {
      const key = field.name || field.label || '';
      return field.required && !variables[key]?.trim();
    });
    if (missingField) {
      toast.error(`${missingField.label || missingField.name} is required`);
      return;
    }

    try {
      const response = await createRequest.mutateAsync({
        catalogItemId,
        catalogItemName: typedCatalogItemName,
        category: values.category?.trim() || undefined,
        estimatedDelivery: values.estimatedDelivery?.trim() || undefined,
        quantity: Number(values.quantity || 1),
        priority: values.priority,
        shortDescription: values.shortDescription || typedCatalogItemName || 'Service request',
        description: values.description,
        notes: values.description,
        variables,
      });
      const requestId = response?.data?.id;
      toast.success('Service request submitted');
      navigate(requestId ? `/service-requests/${requestId}` : '/service-requests');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to submit service request');
    }
  };

  return (
    <SNPage className="min-h-full" style={{ margin: '-24px', background: '#fff' }}>
      <SNRecordHeader
        number="NEW SERVICE REQUEST"
        priorityPill={<SNPillBadge label={PRIORITY_LABEL[priority]} tone={priority === 'P1' ? 'critical' : priority === 'P2' ? 'warn' : 'neutral'} dot />}
        statePill={<SNPillBadge label={selectedItem?.approvalRequired ? 'APPROVAL' : 'FULFILLMENT'} tone={selectedItem?.approvalRequired ? 'warn' : 'info'} />}
        extraBadges={selectedItem?.approvalRequired ? <SNPillBadge label="APPROVAL REQUIRED" tone="warn" /> : <SNPillBadge label="NO APPROVAL" tone="success" />}
        secondaryActions={(
          <button type="button" className="sn-soft-button inline-flex items-center gap-2" onClick={() => navigate('/service-requests')}>
            <ArrowLeft size={15} />
            Back
          </button>
        )}
        onUpdate={handleSubmit(onSubmit)}
        updateLoading={createRequest.isPending}
        updateLabel="Submit"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <SNCollapsibleSection title="Service Request Details">
          <SNRecordGrid>
            <SNRecordField label="Number" required>
              <SNReadOnly>New</SNReadOnly>
            </SNRecordField>
            <SNRecordField label="Opened">
              <SNReadOnly>{nowForHeader()}</SNReadOnly>
            </SNRecordField>
            <SNRecordField label="Requested By">
              <SNReadOnly>{personLabel(currentUser)}</SNReadOnly>
            </SNRecordField>
            <SNRecordField label="Requested For">
              <SNReadOnly>{personLabel(currentUser)}</SNReadOnly>
            </SNRecordField>

            <SNRecordField label="Catalog Item" required>
              <input
                className="sn-field"
                list="service-request-catalog-items"
                placeholder="Type catalog item"
                style={errors.catalogItemName ? { borderColor: sn.critical } : undefined}
                {...register('catalogItemName', { required: 'Catalog item is required' })}
                value={catalogItemName || ''}
                onChange={(event) => {
                  setValue('catalogItemName', event.target.value, { shouldDirty: true, shouldValidate: true });
                  syncCatalogItemText(event.target.value);
                }}
              />
              <input type="hidden" {...register('catalogItemId')} />
              <datalist id="service-request-catalog-items">
                {catalogItems.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </SNRecordField>
            <SNRecordField label="Category">
              <input className="sn-field" placeholder="Type category" {...register('category')} />
            </SNRecordField>
            <SNRecordField label="Quantity">
              <input className="sn-field" type="number" min="1" max="99" {...register('quantity')} />
            </SNRecordField>
            <SNRecordField label="Priority">
              <select className="sn-field" {...register('priority')}>
                <option value="P1">1 - Critical</option>
                <option value="P2">2 - High</option>
                <option value="P3">3 - Moderate</option>
                <option value="P4">4 - Low</option>
              </select>
            </SNRecordField>
            <SNRecordField label="Approval">
              <SNReadOnly>{selectedItem?.approvalRequired ? 'Required' : 'Not required'}</SNReadOnly>
            </SNRecordField>
            <SNRecordField label="Estimated Delivery">
              <input className="sn-field" placeholder="Example: 2 day(s)" {...register('estimatedDelivery')} />
            </SNRecordField>
            <SNRecordField label="Short Description" required>
              <input
                className="sn-field"
                placeholder={selectedItem?.name || 'Brief summary'}
                style={errors.shortDescription ? { borderColor: sn.critical } : undefined}
                {...register('shortDescription')}
              />
            </SNRecordField>
            <SNRecordField label="Description" fullWidth tall stack>
              <textarea className="sn-field" placeholder="Detailed service request description" {...register('description')} />
            </SNRecordField>
          </SNRecordGrid>
        </SNCollapsibleSection>

        <SNCollapsibleSection title="Request Variables">
          <SNRecordGrid>
            {schemaFields.map((field) => {
              const key = field.name || field.label || 'field';
              const type = field.type || 'text';
              return (
                <SNRecordField
                  key={key}
                  label={field.label || field.name || 'Variable'}
                  required={field.required}
                  fullWidth={type === 'textarea'}
                  tall={type === 'textarea'}
                  stack={type === 'textarea'}
                >
                  {type === 'textarea' ? (
                    <textarea
                      className="sn-field"
                      value={variables[key] ?? ''}
                      onChange={(event) => updateVariable(key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : type === 'select' && field.options ? (
                    <select
                      className="sn-field"
                      value={variables[key] ?? ''}
                      onChange={(event) => updateVariable(key, event.target.value)}
                    >
                      <option value="">-- None --</option>
                      {field.options.map((option) => (
                        <option key={optionValue(option)} value={optionValue(option)}>
                          {optionLabel(option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="sn-field"
                      value={variables[key] ?? ''}
                      onChange={(event) => updateVariable(key, event.target.value)}
                      type={type === 'date' ? 'date' : 'text'}
                      placeholder={field.placeholder}
                    />
                  )}
                </SNRecordField>
              );
            })}
          </SNRecordGrid>
        </SNCollapsibleSection>

        <div className="flex justify-end border-x border-b px-6 py-4" style={{ borderColor: sn.border, background: '#fff' }}>
          <button type="submit" className="sn-primary-button inline-flex items-center gap-2" disabled={createRequest.isPending}>
            {createRequest.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Submit
          </button>
        </div>
      </form>
    </SNPage>
  );
}
