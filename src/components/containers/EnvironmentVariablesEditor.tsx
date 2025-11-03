import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Save, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Copy,
  Edit3,
  Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface EnvironmentVariable {
  key: string;
  value: string;
  isNew?: boolean;
  isModified?: boolean;
  isSecret?: boolean;
}

interface EnvironmentVariablesEditorProps {
  variables: Record<string, string>;
  onSave: (variables: Record<string, string>) => Promise<void>;
  loading?: boolean;
  className?: string;
  readOnly?: boolean;
}

interface VariableRowProps {
  variable: EnvironmentVariable;
  index: number;
  onUpdate: (index: number, key: string, value: string) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}

const isSecretKey = (key: string): boolean => {
  const secretPatterns = [
    /password/i,
    /secret/i,
    /key$/i,
    /token/i,
    /auth/i,
    /credential/i,
    /private/i,
  ];
  
  return secretPatterns.some(pattern => pattern.test(key));
};

const VariableRow: React.FC<VariableRowProps> = ({
  variable,
  index,
  onUpdate,
  onRemove,
  readOnly = false,
}) => {
  const [showValue, setShowValue] = useState(!variable.isSecret);
  const [isEditing, setIsEditing] = useState(variable.isNew || false);

  const handleKeyChange = (newKey: string) => {
    onUpdate(index, newKey, variable.value);
  };

  const handleValueChange = (newValue: string) => {
    onUpdate(index, variable.key, newValue);
  };

  const handleCopyValue = async () => {
    try {
      await navigator.clipboard.writeText(variable.value);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-3 border rounded-lg",
      variable.isNew && "border-green-200 bg-green-50",
      variable.isModified && "border-blue-200 bg-blue-50"
    )}>
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {variable.isNew ? (
          <Badge variant="outline" className="text-green-600 border-green-300">
            New
          </Badge>
        ) : variable.isModified ? (
          <Badge variant="outline" className="text-blue-600 border-blue-300">
            Modified
          </Badge>
        ) : (
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        )}
      </div>

      {/* Key field */}
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground">Key</Label>
        {isEditing || variable.isNew ? (
          <Input
            value={variable.key}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="VARIABLE_NAME"
            className="mt-1"
            disabled={readOnly}
          />
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <div className="font-mono text-sm bg-muted px-2 py-1 rounded flex-1">
              {variable.key}
            </div>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleEdit}
                className="h-8 w-8 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Value field */}
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          Value
          {variable.isSecret && <Key className="h-3 w-3" />}
        </Label>
        {isEditing || variable.isNew ? (
          <Input
            type={showValue ? "text" : "password"}
            value={variable.value}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="value"
            className="mt-1"
            disabled={readOnly}
          />
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <div className="font-mono text-sm bg-muted px-2 py-1 rounded flex-1">
              {showValue ? variable.value : '••••••••'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowValue(!showValue)}
              className="h-8 w-8 p-0"
            >
              {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyValue}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleEdit}
                className="h-8 w-8 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {variable.isSecret && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowValue(!showValue)}
            className="h-8 w-8 p-0"
          >
            {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
        
        {!readOnly && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Environment Variable</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove the environment variable "{variable.key}"? 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRemove(index)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export const EnvironmentVariablesEditor: React.FC<EnvironmentVariablesEditorProps> = ({
  variables,
  onSave,
  loading = false,
  className,
  readOnly = false,
}) => {
  const [editableVariables, setEditableVariables] = useState<EnvironmentVariable[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize editable variables from props
  useEffect(() => {
    const vars = Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      isSecret: isSecretKey(key),
    }));
    setEditableVariables(vars);
    setHasChanges(false);
  }, [variables]);

  // Check for changes
  useEffect(() => {
    const originalVars = Object.entries(variables);
    const currentVars = editableVariables.filter(v => v.key.trim() !== '');
    
    const hasChanges = 
      originalVars.length !== currentVars.length ||
      originalVars.some(([key, value]) => {
        const current = currentVars.find(v => v.key === key);
        return !current || current.value !== value;
      }) ||
      currentVars.some(v => v.isNew || v.isModified);
    
    setHasChanges(hasChanges);
  }, [editableVariables, variables]);

  const addVariable = () => {
    setEditableVariables(prev => [
      ...prev,
      { key: '', value: '', isNew: true, isSecret: false }
    ]);
  };

  const updateVariable = (index: number, key: string, value: string) => {
    setEditableVariables(prev => prev.map((variable, i) => {
      if (i === index) {
        const isSecret = isSecretKey(key);
        const originalValue = variables[variable.key];
        const isModified = !variable.isNew && originalValue !== undefined && originalValue !== value;
        
        return {
          ...variable,
          key,
          value,
          isSecret,
          isModified,
        };
      }
      return variable;
    }));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const removeVariable = (index: number) => {
    setEditableVariables(prev => prev.filter((_, i) => i !== index));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const resetChanges = () => {
    const vars = Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      isSecret: isSecretKey(key),
    }));
    setEditableVariables(vars);
    setHasChanges(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaveError(null);
      
      // Validate variables
      const validVariables = editableVariables.filter(v => v.key.trim() !== '');
      const duplicateKeys = validVariables
        .map(v => v.key)
        .filter((key, index, arr) => arr.indexOf(key) !== index);
      
      if (duplicateKeys.length > 0) {
        setSaveError(`Duplicate keys found: ${duplicateKeys.join(', ')}`);
        return;
      }

      // Convert to object
      const variablesObject = validVariables.reduce((acc, variable) => {
        acc[variable.key] = variable.value;
        return acc;
      }, {} as Record<string, string>);

      await onSave(variablesObject);
      
      // Update state to reflect saved changes
      const updatedVars = validVariables.map(v => ({
        ...v,
        isNew: false,
        isModified: false,
      }));
      setEditableVariables(updatedVars);
      setHasChanges(false);
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save environment variables');
    }
  };

  const variableCount = editableVariables.filter(v => v.key.trim() !== '').length;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Environment Variables
            {variableCount > 0 && (
              <Badge variant="secondary">{variableCount}</Badge>
            )}
          </CardTitle>
          
          {!readOnly && (
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetChanges}
                  disabled={loading}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={addVariable}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Variable
              </Button>
              
              {hasChanges && (
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Status messages */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{saveError}</span>
          </div>
        )}
        
        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Environment variables saved successfully</span>
          </div>
        )}
        
        {hasChanges && !saveError && !saveSuccess && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">You have unsaved changes</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {editableVariables.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
              <Key className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No environment variables</h3>
            <p className="text-muted-foreground mb-4">
              {readOnly 
                ? "This service has no environment variables configured."
                : "Add environment variables to configure your service."
              }
            </p>
            {!readOnly && (
              <Button onClick={addVariable}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Variable
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {editableVariables.map((variable, index) => (
              <VariableRow
                key={`${variable.key}-${index}`}
                variable={variable}
                index={index}
                onUpdate={updateVariable}
                onRemove={removeVariable}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
        
        {/* Help text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Environment variables are key-value pairs that configure your service</p>
          <p>• Variables with keys containing "password", "secret", "key", or "token" are automatically marked as sensitive</p>
          <p>• Changes are not applied until you click "Save Changes"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnvironmentVariablesEditor;