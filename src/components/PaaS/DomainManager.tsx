import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';

interface DomainRecord {
  id: string;
  domain: string;
  is_verified: boolean;
  verification_status?: 'pending' | 'verified' | 'failed';
  verification_requested_at?: string;
  verified_at?: string;
  dns_verification_token?: string;
  ssl_enabled: boolean;
  ssl_status?: 'pending' | 'provisioning' | 'active' | 'failed';
  ssl_error?: string;
  ssl_cert_expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface VerificationInfo {
  type: string;
  host: string;
  value: string;
}

interface DomainManagerProps {
  appId: string;
  appSlug: string;
  defaultDomain?: string;
}

const statusClasses: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  provisioning: 'bg-blue-100 text-blue-700',
  verified: 'bg-emerald-100 text-emerald-700',
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const DOMAIN_REGEX =
  /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

export const DomainManager: React.FC<DomainManagerProps> = ({
  appId,
  appSlug,
  defaultDomain = 'apps.example.com',
}) => {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ domains: DomainRecord[] }>(`/paas/apps/${appId}/domains`);
      setDomains(data.domains || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const handleAddDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) {
      toast.error('Enter a domain');
      return;
    }

    if (!DOMAIN_REGEX.test(trimmed)) {
      toast.error('Enter a valid fully-qualified domain (example.com)');
      return;
    }

    setAdding(true);
    try {
      const response = await apiClient.post<{
        domain: DomainRecord;
        verification: VerificationInfo;
      }>(`/paas/apps/${appId}/domains`, { domain: trimmed });
      toast.success('Domain added — configure DNS to verify ownership');
      setNewDomain('');
      setVerificationInfo(response.verification);
      await loadDomains();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifyingId(domainId);
    try {
      await apiClient.post(`/paas/apps/${appId}/domains/${domainId}/verify`, {});
      toast.success('Domain verified');
      await loadDomains();
    } catch (error: any) {
      toast.error(error.message || 'DNS verification not found yet');
    } finally {
      setVerifyingId((current) => (current === domainId ? null : current));
    }
  };

  const handleDelete = async (domainId: string, domainName: string) => {
    if (!confirm(`Remove ${domainName}?`)) {
      return;
    }
    setRemovingId(domainId);
    try {
      await apiClient.delete(`/paas/apps/${appId}/domains/${domainId}`);
      toast.success('Domain removed');
      await loadDomains();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove domain');
    } finally {
      setRemovingId((current) => (current === domainId ? null : current));
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy value');
    }
  };

  const txtRecordOf = useCallback((domain: DomainRecord) => {
    if (!domain.dns_verification_token) return null;
    return {
      host: `_paas-verify.${domain.domain}`,
      value: `paas-verify=${domain.dns_verification_token}`,
    };
  }, []);

  const instructions = useMemo(
    () => ({
      cname: `${appSlug}.${defaultDomain}`,
      apexTarget: `ingress.${defaultDomain}`,
    }),
    [appSlug, defaultDomain]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Custom Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 w-full">
              <Input
                placeholder="app.example.com"
                value={newDomain}
                onChange={(event) => setNewDomain(event.target.value)}
                disabled={adding}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Point a CNAME record to <span className="font-mono">{instructions.cname}</span> or create an A record to your ingress.
              </p>
            </div>
            <Button type="submit" disabled={adding} className="whitespace-nowrap">
              {adding ? 'Adding...' : 'Add Domain'}
            </Button>
          </form>

          {verificationInfo && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verify ownership</AlertTitle>
              <AlertDescription className="space-y-1 text-sm">
                <p>Create the following TXT record, then click Verify.</p>
                <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span>Host: {verificationInfo.host}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(verificationInfo.host, 'Host')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Value: {verificationInfo.value}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(verificationInfo.value, 'Value')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Domains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading domains...</p>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No custom domains yet. Add one to use your own hostname.
            </div>
          ) : (
            domains.map((domain) => {
              const txt = txtRecordOf(domain);
              return (
                <div key={domain.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{domain.domain}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        <Badge className={statusClasses[domain.verification_status || 'pending']}>
                          {domain.verification_status || 'pending'}
                        </Badge>
                        <Badge className={statusClasses[domain.ssl_status || 'pending']}>
                          SSL: {domain.ssl_status || 'pending'}
                        </Badge>
                        {domain.ssl_enabled && <Badge variant="secondary">TLS Enabled</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!domain.is_verified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(domain.id)}
                          disabled={verifyingId === domain.id}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {verifyingId === domain.id ? 'Verifying...' : 'Verify DNS'}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(domain.id, domain.domain)}
                        disabled={removingId === domain.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {removingId === domain.id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {domain.is_verified ? 'Verified' : 'Pending verification'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDate(domain.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SSL Certificate</p>
                      <p className="font-medium">
                        {domain.ssl_status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <ShieldCheck className="h-4 w-4" />
                            Active
                          </span>
                        ) : domain.ssl_status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <ShieldAlert className="h-4 w-4" />
                            Failed
                          </span>
                        ) : (
                          domain.ssl_status || 'pending'
                        )}
                      </p>
                      {domain.ssl_cert_expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDate(domain.ssl_cert_expires_at)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Routing Target</p>
                      <p className="font-mono text-xs">{instructions.cname}</p>
                      <p className="text-xs text-muted-foreground">
                        CNAME to application ingress (Traefik updates automatically)
                      </p>
                    </div>
                  </div>

                  {txt && !domain.is_verified && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono space-y-1">
                      <p className="font-semibold text-muted-foreground">TXT verification record</p>
                      <div className="flex items-center justify-between gap-2">
                        <span>Host: {txt.host}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(txt.host, 'Host')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Value: {txt.value}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(txt.value, 'Value')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {domain.ssl_error && (
                    <Alert variant="destructive" className="text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Certificate error</AlertTitle>
                      <AlertDescription>{domain.ssl_error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">1. Add CNAME or A record</p>
            <p>
              Point <span className="font-mono">app.example.com</span> to{' '}
              <span className="font-mono">{instructions.cname}</span> (CNAME) or your ingress IP.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-foreground">2. Add TXT verification record</p>
            <p>Used to verify ownership. Each domain gets a unique token.</p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-foreground">3. Trigger verification</p>
            <p>
              Click <span className="font-semibold">Verify DNS</span> once DNS propagates (usually under 5 minutes).
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-foreground">4. SSL auto-provisioning</p>
            <p>
              Traefik issues Let&apos;s Encrypt certificates automatically after verification and keeps them renewed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

