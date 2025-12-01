// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect } from "react";
import { Trans, t } from "@lingui/macro";
import { Button } from "./button";
import { Badge } from "./badge";
import { Heading, Subheading } from "./heading";
import { Text } from "./text";
import type { Customer, CustomerType } from "../types/organizational";
import { listCustomers, deleteCustomer } from "../services/customerApi";

/**
 * Icon components for tree visualization
 */
function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function BuildingStorefrontIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
      />
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

/**
 * Get icon for customer type
 */
function getCustomerIcon(type: CustomerType) {
  switch (type) {
    case "corporate":
      return <BuildingStorefrontIcon className="h-5 w-5 text-blue-500" />;
    case "regional":
      return <BuildingStorefrontIcon className="h-5 w-5 text-green-500" />;
    case "local":
      return <BuildingStorefrontIcon className="h-5 w-5 text-purple-500" />;
    case "custom":
      return <UsersIcon className="h-5 w-5 text-orange-500" />;
    default:
      return <BuildingStorefrontIcon className="h-5 w-5 text-gray-500" />;
  }
}

/**
 * Get badge color for customer type
 */
function getTypeBadgeColor(type: CustomerType) {
  switch (type) {
    case "corporate":
      return "blue";
    case "regional":
      return "green";
    case "local":
      return "purple";
    case "custom":
      return "orange";
    default:
      return "zinc";
  }
}

interface CustomerTreeNodeProps {
  customer: Customer;
  level: number;
  onSelect?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onViewObjects?: (customer: Customer) => void;
  selectedId?: string | null;
}

/**
 * Single customer tree node component
 */
function CustomerTreeNode({
  customer,
  level,
  onSelect,
  onEdit,
  onDelete,
  onViewObjects,
  selectedId,
}: CustomerTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = customer.children && customer.children.length > 0;
  const objectCount = customer.objects?.length ?? 0;
  const isSelected = selectedId === customer.id;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    },
    [isExpanded]
  );

  const handleSelect = useCallback(() => {
    onSelect?.(customer);
  }, [onSelect, customer]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(customer);
    },
    [onEdit, customer]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(customer);
    },
    [onDelete, customer]
  );

  const handleViewObjects = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onViewObjects?.(customer);
    },
    [onViewObjects, customer]
  );

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={handleSelect}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect();
          }
        }}
      >
        {/* Expand/Collapse Button */}
        <button
          type="button"
          className={`p-0.5 rounded transition-colors ${
            hasChildren
              ? "hover:bg-gray-200 dark:hover:bg-gray-700"
              : "invisible"
          }`}
          onClick={handleToggle}
          aria-label={isExpanded ? t`Collapse` : t`Expand`}
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Icon */}
        {getCustomerIcon(customer.type)}

        {/* Customer Info */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
            {customer.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {customer.customer_number}
          </span>
        </div>

        {/* Type Badge */}
        <Badge color={getTypeBadgeColor(customer.type)}>{customer.type}</Badge>

        {/* Object Count Badge */}
        {objectCount > 0 && (
          <Badge
            color="zinc"
            className="cursor-pointer"
            onClick={handleViewObjects}
          >
            {objectCount} <Trans>objects</Trans>
          </Badge>
        )}

        {/* Actions - always visible on mobile, hover-only on desktop */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {onViewObjects && objectCount > 0 && (
            <Button
              plain
              onClick={handleViewObjects}
              aria-label={t`View objects for ${customer.name}`}
              className="p-1"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"
                />
              </svg>
            </Button>
          )}
          {onEdit && (
            <Button
              plain
              onClick={handleEdit}
              aria-label={t`Edit ${customer.name}`}
              className="p-1"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </Button>
          )}
          {onDelete && (
            <Button
              plain
              onClick={handleDelete}
              aria-label={t`Delete ${customer.name}`}
              className="p-1 text-red-600 hover:text-red-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {customer.children!.map((child) => (
            <CustomerTreeNode
              key={child.id}
              customer={child}
              level={level + 1}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewObjects={onViewObjects}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface CustomerTreeProps {
  /** Callback when a customer is selected */
  onSelect?: (customer: Customer) => void;
  /** Callback when edit action is triggered */
  onEdit?: (customer: Customer) => void;
  /** Callback when delete action is triggered */
  onDelete?: (customer: Customer) => void;
  /** Callback when view objects action is triggered */
  onViewObjects?: (customer: Customer) => void;
  /** Callback when create action is triggered */
  onCreate?: () => void;
  /** Currently selected customer ID */
  selectedId?: string | null;
  /** Filter by customer type */
  typeFilter?: CustomerType;
  /** Show only root customers (no children) */
  flatView?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Tree view component for displaying customer hierarchy
 *
 * Features:
 * - Hierarchical tree view with expand/collapse
 * - Icons for different customer types
 * - Object count display
 * - Selection support
 * - Edit/Delete/View Objects actions
 * - Loading and error states
 * - Empty state
 */
export function CustomerTree({
  onSelect,
  onEdit,
  onDelete,
  onViewObjects,
  onCreate,
  selectedId,
  typeFilter,
  flatView = false,
  className = "",
}: CustomerTreeProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all customers
      const response = await listCustomers({
        type: typeFilter,
        per_page: 100,
      });

      if (flatView) {
        setCustomers(response.data);
      } else {
        // Build tree from flat list
        const buildTree = (items: Customer[]): Customer[] => {
          const itemMap = new Map<string, Customer>();
          const rootItems: Customer[] = [];

          // First pass: create map
          items.forEach((item) => {
            itemMap.set(item.id, { ...item, children: [] });
          });

          // Second pass: build tree
          items.forEach((item) => {
            const node = itemMap.get(item.id)!;
            if (item.parent?.id && itemMap.has(item.parent.id)) {
              const parent = itemMap.get(item.parent.id)!;
              parent.children = parent.children || [];
              parent.children.push(node);
            } else {
              rootItems.push(node);
            }
          });

          return rootItems;
        };

        setCustomers(buildTree(response.data));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t`Failed to load customers`
      );
    } finally {
      setIsLoading(false);
    }
  }, [flatView, typeFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleDelete = useCallback(
    async (customer: Customer) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete "${customer.name}"? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteCustomer(customer.id);
        await loadCustomers();
        onDelete?.(customer);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t`Failed to delete customer`
        );
      }
    },
    [loadCustomers, onDelete]
  );

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${className} text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg`}
      >
        <Text>{error}</Text>
        <Button plain onClick={loadCustomers} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div
        className={`${className} text-center py-8 text-gray-500 dark:text-gray-400`}
      >
        <BuildingStorefrontIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <Subheading>
          <Trans>No Customers</Trans>
        </Subheading>
        <Text className="mt-2">
          <Trans>Get started by adding your first customer.</Trans>
        </Text>
        {onCreate && (
          <Button onClick={onCreate} className="mt-4">
            <Trans>Add Customer</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}>
          <Trans>Customer Hierarchy</Trans>
        </Heading>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Add Customer</Trans>
          </Button>
        )}
      </div>

      <div
        role="tree"
        aria-label={t`Customer hierarchy`}
        className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800"
      >
        {customers.map((customer) => (
          <div key={customer.id} className="group">
            <CustomerTreeNode
              customer={customer}
              level={0}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={handleDelete}
              onViewObjects={onViewObjects}
              selectedId={selectedId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CustomerTree;
