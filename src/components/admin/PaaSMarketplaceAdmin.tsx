/**
 * Admin PaaS Marketplace Management Component
 * Manage marketplace templates and addons
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Star, Package, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  git_url: string;
  buildpack?: string;
  is_active: boolean;
  is_featured: boolean;
  deploy_count: number;
}

interface Addon {
  id: string;
  name: string;
  slug: string;
  description?: string;
  addon_type: string;
  price_per_hour: number;
  is_active: boolean;
}

export const PaaSMarketplaceAdmin: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'nodejs',
    git_url: '',
    git_branch: 'main',
    buildpack: '',
    is_featured: false,
  });

  // Addon form state
  const [addonForm, setAddonForm] = useState({
    name: '',
    slug: '',
    description: '',
    addon_type: 'database',
    price_per_hour: '0.00',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesData, addonsData] = await Promise.all([
        apiClient.get('/admin/paas/marketplace/templates'),
        apiClient.get('/admin/paas/marketplace/addons'),
      ]);
      setTemplates(templatesData.templates || []);
      setAddons(addonsData.addons || []);
    } catch (error) {
      toast.error('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await apiClient.patch(`/admin/paas/marketplace/templates/${editingTemplate.id}`, templateForm);
        toast.success('Template updated');
      } else {
        await apiClient.post('/admin/paas/marketplace/templates', templateForm);
        toast.success('Template created');
      }
      setTemplateDialogOpen(false);
      resetTemplateForms();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    }
  };

  const handleSaveAddon = async () => {
    try {
      const payload = {
        ...addonForm,
        price_per_hour: parseFloat(addonForm.price_per_hour),
      };

      if (editingAddon) {
        await apiClient.patch(`/admin/paas/marketplace/addons/${editingAddon.id}`, payload);
        toast.success('Addon updated');
      } else {
        await apiClient.post('/admin/paas/marketplace/addons', payload);
        toast.success('Addon created');
      }
      setAddonDialogOpen(false);
      resetAddonForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save addon');
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await apiClient.delete(`/admin/paas/marketplace/templates/${id}`);
      toast.success('Template deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const handleDeleteAddon = async (id: string, name: string) => {
    if (!confirm(`Delete addon "${name}"?`)) return;
    try {
      await apiClient.delete(`/admin/paas/marketplace/addons/${id}`);
      toast.success('Addon deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete addon');
    }
  };

  const handleToggleTemplateActive = async (template: Template) => {
    try {
      await apiClient.patch(`/admin/paas/marketplace/templates/${template.id}`, {
        is_active: !template.is_active,
      });
      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (error: any) {
      toast.error('Failed to update template');
    }
  };

  const handleToggleAddonActive = async (addon: Addon) => {
    try {
      await apiClient.patch(`/admin/paas/marketplace/addons/${addon.id}`, {
        is_active: !addon.is_active,
      });
      toast.success(`Addon ${addon.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (error: any) {
      toast.error('Failed to update addon');
    }
  };

  const openTemplateDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        slug: template.slug,
        description: template.description || '',
        category: template.category,
        git_url: template.git_url,
        git_branch: 'main',
        buildpack: template.buildpack || '',
        is_featured: template.is_featured,
      });
    }
    setTemplateDialogOpen(true);
  };

  const openAddonDialog = (addon?: Addon) => {
    if (addon) {
      setEditingAddon(addon);
      setAddonForm({
        name: addon.name,
        slug: addon.slug,
        description: addon.description || '',
        addon_type: addon.addon_type,
        price_per_hour: addon.price_per_hour.toString(),
      });
    }
    setAddonDialogOpen(true);
  };

  const resetTemplateForms = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      slug: '',
      description: '',
      category: 'nodejs',
      git_url: '',
      git_branch: 'main',
      buildpack: '',
      is_featured: false,
    });
  };

  const resetAddonForm = () => {
    setEditingAddon(null);
    setAddonForm({
      name: '',
      slug: '',
      description: '',
      addon_type: 'database',
      price_per_hour: '0.00',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Marketplace Management</h2>
        <p className="text-muted-foreground">Manage templates and addons for the PaaS marketplace</p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            <Package className="w-4 h-4 mr-2" />
            Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="addons">
            <Database className="w-4 h-4 mr-2" />
            Add-ons ({addons.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Marketplace Templates</CardTitle>
                <Button onClick={() => { resetTemplateForms(); openTemplateDialog(); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Deploys</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {template.is_featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                            {template.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell>{template.deploy_count}</TableCell>
                        <TableCell>
                          <Badge className={template.is_active ? 'bg-green-500' : 'bg-gray-500'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openTemplateDialog(template)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleTemplateActive(template)}
                            >
                              {template.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTemplate(template.id, template.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Addons Tab */}
        <TabsContent value="addons">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Marketplace Add-ons</CardTitle>
                <Button onClick={() => { resetAddonForm(); openAddonDialog(); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Add-on
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price/hr</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addons.map((addon) => (
                      <TableRow key={addon.id}>
                        <TableCell>{addon.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{addon.addon_type}</Badge>
                        </TableCell>
                        <TableCell>${Number(addon.price_per_hour).toFixed(3)}</TableCell>
                        <TableCell>
                          <Badge className={addon.is_active ? 'bg-green-500' : 'bg-gray-500'}>
                            {addon.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openAddonDialog(addon)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleAddonActive(addon)}
                            >
                              {addon.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAddon(addon.id, addon.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) resetTemplateForms(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Template</DialogTitle>
            <DialogDescription>Configure marketplace template details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={templateForm.slug} onChange={(e) => setTemplateForm({ ...templateForm, slug: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={templateForm.category} onValueChange={(v) => setTemplateForm({ ...templateForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nodejs">Node.js</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="php">PHP</SelectItem>
                    <SelectItem value="cms">CMS</SelectItem>
                    <SelectItem value="frontend">Frontend</SelectItem>
                    <SelectItem value="full-stack">Full-Stack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Buildpack</Label>
                <Input value={templateForm.buildpack} onChange={(e) => setTemplateForm({ ...templateForm, buildpack: e.target.value })} placeholder="heroku/nodejs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Git URL</Label>
              <Input value={templateForm.git_url} onChange={(e) => setTemplateForm({ ...templateForm, git_url: e.target.value })} placeholder="https://github.com/..." />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="featured"
                checked={templateForm.is_featured}
                onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_featured: checked as boolean })}
              />
              <Label htmlFor="featured">Featured Template</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTemplateDialogOpen(false); resetTemplateForms(); }}>Cancel</Button>
            <Button onClick={handleSaveTemplate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Addon Dialog */}
      <Dialog open={addonDialogOpen} onOpenChange={(open) => { setAddonDialogOpen(open); if (!open) resetAddonForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddon ? 'Edit' : 'Create'} Add-on</DialogTitle>
            <DialogDescription>Configure marketplace add-on details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={addonForm.slug} onChange={(e) => setAddonForm({ ...addonForm, slug: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={addonForm.addon_type} onValueChange={(v) => setAddonForm({ ...addonForm, addon_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="cache">Cache</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price per Hour ($)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={addonForm.price_per_hour}
                  onChange={(e) => setAddonForm({ ...addonForm, price_per_hour: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddonDialogOpen(false); resetAddonForm(); }}>Cancel</Button>
            <Button onClick={handleSaveAddon}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
